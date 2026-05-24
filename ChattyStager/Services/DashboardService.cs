namespace ChattyStager.Services;

using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using ChattyStager.Helpers;

public class DashboardData
{
    public int UsersLast24h { get; set; }
    public int LoginsLast24h { get; set; }
    public int TotalUsers { get; set; }
    public int MessagesLast24h { get; set; }
    public double CpuUsage { get; set; }
    public double MemoryUsageMB { get; set; }
    public double TotalMemoryMB { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class DashboardService
{
    public async Task<DashboardData> GetDataAsync()
    {
        var data = new DashboardData();
        var since = DateTime.UtcNow.AddHours(-24);

        try
        {
            var usersTask = DBConnectionHelper.ScalarAsync(
                "SELECT COUNT(*) FROM users WHERE created_at >= @since",
                new Dictionary<string, object> { { "since", since.ToString("yyyy-MM-dd HH:mm:ss") } });

            var totalTask = DBConnectionHelper.ScalarAsync(
                "SELECT COUNT(*) FROM users");

            var messagesTask = DBConnectionHelper.ScalarAsync(
                "SELECT COUNT(*) FROM messages WHERE created_at >= @since",
                new Dictionary<string, object> { { "since", since.ToString("yyyy-MM-dd HH:mm:ss") } });

            await Task.WhenAll(usersTask, totalTask, messagesTask);

            if (usersTask.Result.Success)
                data.UsersLast24h = Convert.ToInt32(usersTask.Result.Value ?? 0);
            if (totalTask.Result.Success)
                data.TotalUsers = Convert.ToInt32(totalTask.Result.Value ?? 0);
            if (messagesTask.Result.Success)
                data.MessagesLast24h = Convert.ToInt32(messagesTask.Result.Value ?? 0);
        }
        catch
        {
        }

        data.LoginsLast24h = 0;

        try
        {
            var process = Process.GetCurrentProcess();
            data.MemoryUsageMB = Math.Round(process.WorkingSet64 / 1024.0 / 1024.0, 1);
        }
        catch
        {
            data.MemoryUsageMB = 0;
        }

        try
        {
            data.TotalMemoryMB = GetTotalPhysicalMemoryMB();
        }
        catch
 {
                   data.TotalMemoryMB = 0;
        }

        return data;
    }

    private static double GetTotalPhysicalMemoryMB()
    {
        if (OperatingSystem.IsLinux())
        {
            try
            {
                var content = File.ReadAllText("/proc/meminfo");
                foreach (var line in content.Split('\n'))
                {
                    if (line.StartsWith("MemTotal:"))
                    {
                        var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 2 && long.TryParse(parts[1], out var kb))
                            return Math.Round(kb / 1024.0, 1);
                    }
                }
            }
            catch
            {
            }
        }

        if (OperatingSystem.IsMacOS())
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "sysctl",
                        Arguments = "hw.memsize",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                process.Start();
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit();
                if (output.Contains(":"))
                {
                    var value = output.Split(':')[1].Trim();
                    if (long.TryParse(value, out var bytes))
                        return Math.Round(bytes / 1024.0 / 1024.0, 1);
                }
            }
            catch
            {
            }
        }

        if (OperatingSystem.IsWindows())
        {
            try
            {
                var process = Process.GetCurrentProcess();
                return Math.Round(process.WorkingSet64 / 1024.0 / 1024.0, 1);
            }
            catch
            {
            }
        }

        try
        {
            var process = Process.GetCurrentProcess();
            return Math.Round(process.WorkingSet64 / 1024.0 / 1024.0, 1);
        }
        catch
        {
            return 0;
        }
    }
}
