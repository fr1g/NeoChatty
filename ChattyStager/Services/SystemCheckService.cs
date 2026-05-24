namespace ChattyStager.Services;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

public class SystemCheckResult
{
    public bool NodeJsInstalled { get; set; }
    public string NodeJsVersion { get; set; } = "";
    public bool MySqlInstalled { get; set; }
    public string MySqlVersion { get; set; } = "";
    public bool Port80Available { get; set; }
    public bool Port443Available { get; set; }
    public bool Port5637Available { get; set; }
    public string OsDescription { get; set; } = "";
    public bool AllChecksPassed =>
        NodeJsInstalled && MySqlInstalled &&
        Port80Available && Port443Available && Port5637Available;
}

public class SystemCheckService
{
    public async Task<SystemCheckResult> CheckAsync()
    {
        var result = new SystemCheckResult
        {
            OsDescription = GetOsDescription()
        };

        var nodeTask = CheckNodeJsAsync();
        var mysqlTask = CheckMySqlAsync();
        var portsTask = CheckPortsAsync();

        await Task.WhenAll(nodeTask, mysqlTask, portsTask);

        result.NodeJsInstalled = nodeTask.Result.installed;
        result.NodeJsVersion = nodeTask.Result.version;
        result.MySqlInstalled = mysqlTask.Result.installed;
        result.MySqlVersion = mysqlTask.Result.version;
        result.Port80Available = portsTask.Result.port80;
        result.Port443Available = portsTask.Result.port443;
        result.Port5637Available = portsTask.Result.port5637;

        return result;
    }

    private static string GetOsDescription()
    {
        if (OperatingSystem.IsWindows())
            return $"Windows {Environment.OSVersion.Version}";
        if (OperatingSystem.IsLinux())
        {
            try
            {
                var content = System.IO.File.ReadAllText("/etc/os-release");
                var lines = content.Split('\n');
                foreach (var line in lines)
                {
                    if (line.StartsWith("PRETTY_NAME="))
                        return line.Substring(13).Trim('"');
                }
            }
            catch { }
            return $"Linux {Environment.OSVersion.Version}";
        }
        if (OperatingSystem.IsMacOS())
            return $"macOS {Environment.OSVersion.Version}";
        return Environment.OSVersion.ToString();
    }

    private static async Task<(bool installed, string version)> CheckNodeJsAsync()
    {
        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = OperatingSystem.IsWindows() ? "node.exe" : "node",
                    Arguments = "--version",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();

            if (process.ExitCode == 0)
            {
                var version = output.Trim();
                if (version.StartsWith("v"))
                    version = version.Substring(1);
                var parts = version.Split('.');
                if (parts.Length >= 1 && int.TryParse(parts[0], out var major) && major >= 24)
                    return (true, version);
                return (true, $"{version} (below v24)");
            }
            return (false, "");
        }
        catch
        {
            return (false, "");
        }
    }

    private static async Task<(bool installed, string version)> CheckMySqlAsync()
    {
        try
        {
            var fileName = OperatingSystem.IsWindows() ? "mysql.exe" : "mysql";
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = "--version",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();

            if (process.ExitCode == 0)
            {
                var version = output.Trim();
                return (true, version);
            }
            return (false, "");
        }
        catch
        {
            return (false, "");
        }
    }

    private static async Task<(bool port80, bool port443, bool port5637)> CheckPortsAsync()
    {
        var port80 = true;
        var port443 = true;
        var port5637 = true;

        try
        {
            using var tcpClient = new System.Net.Sockets.TcpClient();
            try { tcpClient.Connect("127.0.0.1", 80); port80 = false; }
            catch { }
        }
        catch { }

        try
        {
            using var tcpClient = new System.Net.Sockets.TcpClient();
            try { tcpClient.Connect("127.0.0.1", 443); port443 = false; }
            catch { }
        }
        catch { }

        try
        {
            using var tcpClient = new System.Net.Sockets.TcpClient();
            try { tcpClient.Connect("127.0.0.1", 5637); port5637 = false; }
            catch { }
        }
        catch { }

        return await Task.FromResult((port80, port443, port5637));
    }
}
