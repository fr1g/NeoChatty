namespace ChattyStager.Services;

using ChattyStager.Model;
using System.Diagnostics;
using System.Net.Http.Json;
using System.Runtime.InteropServices;
using System.Text.Json;

public class BackendSupervisorService
{
    private readonly StagerConfigService _configService;
    private readonly HttpClient _httpClient;
    private Process? _process;
    private DateTimeOffset? _startedAt;

    /// <summary>Fires on every stdout/stderr line from the managed backend process.</summary>
    public event Action<string>? OnLogLine;

    public BackendSupervisorService(StagerConfigService configService, HttpClient httpClient)
    {
        _configService = configService;
        _httpClient = httpClient;
    }

    public async Task<BackendRuntimeStatus> GetStatusAsync(StagerConfig config)
    {
        _configService.ApplyDefaults(config);
        var recordedPid = ReadRecordedPid(config);
        var livePid = _process is { HasExited: false } ? _process.Id : recordedPid;
        var healthOk = await CheckHealthAsync(config.HealthUrl);
        var isRunning = livePid.HasValue && ProcessExists(livePid.Value) && healthOk;

        return new BackendRuntimeStatus(
            isRunning,
            isRunning ? livePid : null,
            recordedPid,
            _startedAt,
            config.HealthUrl,
            healthOk,
            isRunning ? "Backend is running and healthy." : "Backend stopped. Start backend in Settings.",
            _configService.GetBackendLogPath(config));
    }

    public async Task<BackendRuntimeStatus> StartAsync(StagerConfig config)
    {
        _configService.ApplyDefaults(config);
        var current = await GetStatusAsync(config);
        if (current.IsRunning)
            return current;

        if (!Directory.Exists(config.BackendWorkingDirectory))
            throw new DirectoryNotFoundException($"Backend working directory was not found: {config.BackendWorkingDirectory}");

        Directory.CreateDirectory(config.LogDirectory);
        await _configService.WriteServerConfigAsync(config);

        var logPath = _configService.GetBackendLogPath(config);
        var startInfo = new ProcessStartInfo
        {
            FileName = config.BackendExecutable,
            Arguments = config.BackendArguments,
            WorkingDirectory = config.BackendWorkingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        foreach (var pair in ParseEnvironment(config.BackendEnvironment))
            startInfo.Environment[pair.Key] = pair.Value;

        _process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        _process.OutputDataReceived += async (_, args) =>
        {
            if (args.Data != null)
            {
                await WriteLogLineAsync(logPath, args.Data);
                OnLogLine?.Invoke(args.Data);
            }
        };
        _process.ErrorDataReceived += async (_, args) =>
        {
            if (args.Data != null)
            {
                await WriteLogLineAsync(logPath, args.Data);
                OnLogLine?.Invoke(args.Data);
            }
        };

        if (!_process.Start())
            throw new InvalidOperationException("Failed to start backend process.");

        _process.BeginOutputReadLine();
        _process.BeginErrorReadLine();
        _startedAt = DateTimeOffset.Now;
        await File.WriteAllTextAsync(_configService.GetPidPath(config), _process.Id.ToString());
        await WriteStatusAsync(config, _process.Id, _startedAt.Value);

        for (var i = 0; i < 30; i++)
        {
            await Task.Delay(500);
            if (await CheckHealthAsync(config.HealthUrl))
                return await GetStatusAsync(config);
            if (_process.HasExited)
                throw new InvalidOperationException($"Backend exited with code {_process.ExitCode}. See {_configService.GetBackendLogPath(config)}.");
        }

        throw new TimeoutException($"Backend did not pass health check at {config.HealthUrl}.");
    }

    public async Task<BackendRuntimeStatus> StopAsync(StagerConfig config)
    {
        _configService.ApplyDefaults(config);
        var pid = _process is { HasExited: false } ? _process.Id : ReadRecordedPid(config);
        if (!pid.HasValue)
            return await GetStatusAsync(config);

        try
        {
            var process = Process.GetProcessById(pid.Value);

            // Graceful shutdown: send SIGINT (Ctrl+C) first.
            if (OperatingSystem.IsWindows())
                GenerateConsoleCtrlEvent(CTRL_C_EVENT, (uint)pid.Value);
            else
                process.Kill(entireProcessTree: false); // Unix: Kill sends SIGTERM by default.

            // Wait up to 5 seconds for graceful exit, then force kill.
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            try
            {
                await process.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                process.Kill(entireProcessTree: true);
                await process.WaitForExitAsync();
            }
        }
        catch
        {
        }

        _process = null;
        DeleteIfExists(_configService.GetPidPath(config));
        DeleteIfExists(_configService.GetStatusPath(config));
        return await GetStatusAsync(config);
    }

    private const uint CTRL_C_EVENT = 0;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GenerateConsoleCtrlEvent(uint dwCtrlEvent, uint dwProcessGroupId);

    private static Dictionary<string, string> ParseEnvironment(string raw)
    {
        var result = new Dictionary<string, string>();
        foreach (var line in raw.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var idx = line.IndexOf('=');
            if (idx <= 0)
                continue;
            result[line[..idx]] = line[(idx + 1)..];
        }
        return result;
    }

    private async Task<bool> CheckHealthAsync(string url)
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            using var response = await _httpClient.GetAsync(url, cts.Token);
            if (!response.IsSuccessStatusCode)
                return false;

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cts.Token);
            return json.TryGetProperty("success", out var success) && success.GetBoolean();
        }
        catch
        {
            return false;
        }
    }

    private static bool ProcessExists(int pid)
    {
        try
        {
            var process = Process.GetProcessById(pid);
            return !process.HasExited;
        }
        catch
        {
            return false;
        }
    }

    private static int? ReadRecordedPid(StagerConfig config)
    {
        var path = Path.Combine(config.LogDirectory, "backend.pid");
        if (!File.Exists(path))
            return null;
        return int.TryParse(File.ReadAllText(path).Trim(), out var pid) ? pid : null;
    }

    private async Task WriteStatusAsync(StagerConfig config, int pid, DateTimeOffset startedAt)
    {
        var payload = JsonSerializer.Serialize(new { pid, startedAt }, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(_configService.GetStatusPath(config), payload);
    }

    private static async Task WriteLogLineAsync(string path, string line)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes($"[{DateTimeOffset.Now:O}] {line}{Environment.NewLine}");
        await using var stream = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite);
        await stream.WriteAsync(bytes);
    }

    public async Task<string> ReadRecentLogAsync(StagerConfig config, int maxLines = 50)
    {
        var logPath = _configService.GetBackendLogPath(config);
        if (!File.Exists(logPath))
            return "";

        // Read the last N lines efficiently by reading from the end.
        var lines = new List<string>();
        var buffer = new byte[4096];
        await using var stream = new FileStream(logPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        var fileLength = stream.Length;
        if (fileLength == 0)
            return "";

        var position = fileLength;
        var incompleteLine = "";

        while (position > 0 && lines.Count < maxLines)
        {
            var bytesToRead = (int)Math.Min(buffer.Length, position);
            position -= bytesToRead;
            stream.Seek(position, SeekOrigin.Begin);
            await stream.ReadExactlyAsync(buffer, 0, bytesToRead);

            var chunk = System.Text.Encoding.UTF8.GetString(buffer, 0, bytesToRead);
            var chunkLines = (chunk + incompleteLine).Split('\n');

            incompleteLine = chunkLines[0];

            for (var i = chunkLines.Length - 1; i >= 1; i--)
            {
                var line = chunkLines[i].TrimEnd('\r');
                if (!string.IsNullOrWhiteSpace(line))
                {
                    lines.Insert(0, line);
                    if (lines.Count >= maxLines)
                        break;
                }
            }
        }

        return string.Join(Environment.NewLine, lines);
    }

    private static void DeleteIfExists(string path)
    {
        if (File.Exists(path))
            File.Delete(path);
    }
}
