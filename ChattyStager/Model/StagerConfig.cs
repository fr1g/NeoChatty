﻿namespace ChattyStager.Model;

using System.Text.Json;
using System.IO;

public class StagerConfig
{
    public bool IsSetUp { get; set; } = false;
    public bool UseHttps { get; set; } = false;
    public string PassKey { get; set; } = "";
    public string ChattyWebEndpoint { get; set; } = "";
    public string ChattyHostName { get; set; } = "";
    public string MySqlAddr { get; set; } = "";
    public ushort MySqlPort { get; set; } = 3306;
    public string MySqlUser { get; set; } = "";
    public string MySqlPass { get; set; } = "";
    public string MySqlDatabase { get; set; } = "chatty";




    public static async Task Flush(StagerConfig safeNewVersionConfig)
    {
        try
        {
            var jsonText = JsonSerializer.Serialize(safeNewVersionConfig);
            await File.WriteAllTextAsync(Path.Combine(new DirectoryInfo(Directory.GetCurrentDirectory()).FullName, "ChattyStager.json"), jsonText);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine(e);
            throw new InvalidOperationException("Unable to create ChattyStager.json");
        }
    }

    public static async Task<StagerConfig?> TryLoad(string filePath)
    {
        StagerConfig? fromJson;
        try
        {
            var read = await File.ReadAllTextAsync(filePath);
            fromJson =  JsonSerializer.Deserialize<StagerConfig>(read);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            return null;
        }
        return fromJson;
    }

    public static async Task<bool> HasValidConfig(bool overrideExisting = false, bool mustBeSetUp = false)
    {
        try
        {
            var di = new DirectoryInfo(Directory.GetCurrentDirectory());
        
            foreach (var scan in di.GetFiles())
            {
                if (scan.Name != "ChattyStager.json") continue;
                var load = await TryLoad(scan.FullName);
                if (load != null)
                {
                    return !mustBeSetUp || load.IsSetUp;
                }
                if (!overrideExisting)
                    scan.CopyTo(Path.Combine(di.FullName,
                        $"ChattyStager.invalid.{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}.json"));
                scan.Delete();
            }
        }
        catch (InvalidOperationException e)
        {
            Console.WriteLine(e);
            return false;
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
        return false;
    }

    public static async Task<bool> TryCreateConfig(bool force = false)
    {
        var di = new DirectoryInfo(Directory.GetCurrentDirectory());
        
        // absolute need to create new
        try
        {
            var isValidConfigCreated = await HasValidConfig(force);
            if (isValidConfigCreated)
                return true;
            
            var jsonText = JsonSerializer.Serialize(new StagerConfig());
            await File.WriteAllTextAsync(Path.Combine(di.FullName, "ChattyStager.json"), jsonText);
            return true;
            
        }
        catch (Exception e)
        {
            Console.Error.WriteLine(e);
            throw new InvalidOperationException("Unable to create ChattyStager.json");
        }
        
        return false;
    }

    public static async Task<StagerConfig> LoadOrCreateAsync()
    {
        var di = new DirectoryInfo(Directory.GetCurrentDirectory());
        var configPath = Path.Combine(di.FullName, "ChattyStager.json");

        if (File.Exists(configPath))
        {
            var loaded = await TryLoad(configPath);
            if (loaded != null)
                return loaded;
        }

        var config = new StagerConfig();
        var jsonText = JsonSerializer.Serialize(config);
        await File.WriteAllTextAsync(configPath, jsonText);
        return config;
    }
}