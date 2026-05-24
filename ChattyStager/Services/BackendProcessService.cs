namespace ChattyStager.Services;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public class BackendProcessService : IDisposable
{
    private Process? _process;
    private readonly string _workingDirectory;
    private readonly object _lock = new();
    private CancellationTokenSource? _outputCts;
    private readonly StringBuilder _outputBuffer = new();
    private readonly int _maxOutputLength = 10000;

    public event EventHandler<string>? OutputReceived;
    public event EventHandler<string>? ErrorReceived;
    public event EventHandler<bool>? StatusChanged;

    public bool IsRunning
    {
        get
        {
            lock (_lock)
            {
                return _process != null && !_process.HasExited;
            }
        }
    }

    public BackendProcessService()
    {
        _workingDirectory = Path.Combine(Directory.GetCurrentDirectory(), "backend");
    }

    public async Task<(bool success, string message)> StartAsync()
    {
        lock (_lock)
        {
            if (_process != null && !_process.HasExited)
            {
                return (false, "Backend is already running");
            }

            if (!Directory.Exists(_workingDirectory))
            {
                return (false, $"Backend directory not found: {_workingDirectory}");
            }

            var distIndexJs = Path.Combine(_workingDirectory, "dist", "index.js");
            var mainIndexJs = Path.Combine(_workingDirectory, "index.js");
            var entryPoint = File.Exists(distIndexJs) ? Path.Combine("dist", "index.js") : "index.js";

            if (!File.Exists(Path.Combine(_workingDirectory, distIndexJs)) &&
                !File.Exists(Path.Combine(_workingDirectory, mainIndexJs)))
            {
                return (false, "No entry point found (dist/index.js or index.js)");
            }

            _outputCts = new CancellationTokenSource();
            _outputBuffer.Clear();

            _process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "node",
                    Arguments = entryPoint,
                    WorkingDirectory = _workingDirectory,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    StandardOutputEncoding = System.Text.Encoding.UTF8,
                    StandardErrorEncoding = System.Text.Encoding.UTF8
                },
                EnableRaisingEvents = true
            };

            _process.Exited += (sender, args) =>
            {
                StatusChanged?.Invoke(this, false);
                OutputReceived?.Invoke(this, $"[Process exited with code {_process?.ExitCode}]");
            };

            _process.Start();

            _ = Task.Run(async () =>
            {
                try
                {
                    while (!_outputCts.Token.IsCancellationRequested)
                    {
                        var line = await _process.StandardOutput.ReadLineAsync();
                        if (line == null) break;
                        AppendOutput(line);
                        OutputReceived?.Invoke(this, line);
                    }
                }
                catch (OperationCanceledException)
                {
                }
            }, _outputCts.Token);

            _ = Task.Run(async () =>
            {
                try
                {
                    while (!_outputCts.Token.IsCancellationRequested)
                    {
                        var line = await _process.StandardError.ReadLineAsync();
                        if (line == null) break;
                        AppendOutput($"[ERR] {line}");
                        ErrorReceived?.Invoke(this, line);
                    }
                }
                catch (OperationCanceledException)
                {
                }
            }, _outputCts.Token);

            StatusChanged?.Invoke(this, true);
            return (true, "Backend started successfully");
        }
    }

    public async Task<(bool success, string message)> StopAsync()
    {
        lock (_lock)
        {
            if (_process == null || _process.HasExited)
                return (false, "Backend is not running");

            try
            {
                _outputCts?.Cancel();

                if (!_process.HasExited)
                {
                    _process.Kill(entireProcessTree: true);
                }

                _process.Dispose();
                _process = null;

                StatusChanged?.Invoke(this, false);
                return (true, "Backend stopped");
            }
            catch (Exception ex)
            {
                return (false, $"Failed to stop backend: {ex.Message}");
            }
        }
    }

    public async Task<(bool success, string message)> RestartAsync()
    {
        await StopAsync();
        await Task.Delay(1000);
        return await StartAsync();
    }

    public string? GetOutput()
    {
        lock (_lock)
        {
            var output = _outputBuffer.ToString();
            return string.IsNullOrEmpty(output) ? null : output;
        }
    }

    public List<string> GetRecentOutput(int lines = 50)
    {
        lock (_lock)
        {
            var all = _outputBuffer.ToString();
            if (string.IsNullOrEmpty(all))
                return new List<string>();

            var parts = all.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            var start = Math.Max(0, parts.Length - lines);
            var result = new List<string>();
            for (int i = start; i < parts.Length; i++)
            {
                result.Add(parts[i].TrimEnd('\r'));
            }
            return result;
        }
    }

    private void AppendOutput(string line)
    {
        lock (_lock)
        {
            _outputBuffer.AppendLine(line);
            if (_outputBuffer.Length > _maxOutputLength)
            {
                var excess = _outputBuffer.Length - _maxOutputLength;
                _outputBuffer.Remove(0, excess);
            }
        }
    }

    public void Dispose()
    {
        _outputCts?.Cancel();
        _outputCts?.Dispose();
        lock (_lock)
        {
            if (_process != null && !_process.HasExited)
            {
                try
                {
                    _process.Kill(entireProcessTree: true);
                }
                catch
                {
                }
            }

            _process?.Dispose();
            _process = null;
        }
    }
}