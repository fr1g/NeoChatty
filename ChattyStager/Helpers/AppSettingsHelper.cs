namespace ChattyStager.Helpers;

using System.Text.Json;
using System.Text.Json.Nodes;

public class AppSettingsHelper
{
    public static void AppSettingsCheck()
    {
        Console.WriteLine("ChattyStager checking for appsettings.json...");
        const string MainListenerJsonContent = """
                                               {
                                                 "Logging": {
                                                   "LogLevel": {
                                                     "Default": "Information",
                                                     "Microsoft.AspNetCore": "Warning"
                                                   }
                                                 },
                                                 "Kestrel": {
                                                 "Endpoints": {
                                                   "Http": {
                                                     "Url": "http://*:80"
                                                   },
                                                   "Https": {
                                                     "Url": "https://*:443",
                                                     "Certificate": {
                                                       "Path": "certs/your_certificate.pfx",
                                                       "Password": "your_password"
                                                     }
                                                   }
                                                 }
                                               },
                                                 "AllowedHosts": "*"
                                               }
                                               """;

        const string DefaultJsonContent = """
                                          {
                                            "Logging": {
                                              "LogLevel": {
                                                "Default": "Information",
                                                "Microsoft.AspNetCore": "Warning"
                                              }
                                            },
                                            "AllowedHosts": "*"
                                          }
                                          """;

        var currentDir = Environment.CurrentDirectory; // 运行目录
        var mainListenerFile = Path.Combine(currentDir, "appsettings.mainListener.json");
        var defaultFile = Path.Combine(currentDir, "appsettings.default.json");
        var appSettingsFile = Path.Combine(currentDir, "appsettings.json");

// 1. 如果 appsettings.mainListener.json 不存在
        if (!File.Exists(mainListenerFile))
        {
            // 检查 appsettings.json 中是否存在 Kestrel:Endpoints
            var hasEndpoints = false;
            if (File.Exists(appSettingsFile))
            {
                try
                {
                    var jsonContent = File.ReadAllText(appSettingsFile);
                    var root = JsonNode.Parse(jsonContent);
                    hasEndpoints = root?["Kestrel"]?["Endpoints"] != null;
                    Console.WriteLine($"Current AppSettings {(hasEndpoints ? "includes" : "doesn't include")} Endpoint settings, {(hasEndpoints ? "you maybe using ChattyStager as main web server" : "this maybe is a default settings file")}.");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Failed to read appsettings.json: {ex.Message}");
                }
            }

            if (!hasEndpoints)
            {
                File.WriteAllText(mainListenerFile, MainListenerJsonContent);
                Console.WriteLine($"Generated file: {mainListenerFile}");
            }
        }

// 2. 如果现有 appsettings.json 中存在 Endpoints 对象，且 appsettings.default.json 不存在
        if (File.Exists(appSettingsFile) && !File.Exists(defaultFile))
        {
            Console.WriteLine("The default AppSettings doesn't exist. If current one contains an Endpoints block, ChattyStager will generate a default one as backup.");
            var hasEndpoints = false;
            try
            {
                var jsonContent = File.ReadAllText(appSettingsFile);
                var root = JsonNode.Parse(jsonContent);
                hasEndpoints = root?["Kestrel"]?["Endpoints"] != null;
                Console.WriteLine($"Current AppSettings {(hasEndpoints ? "includes" : "doesn't include")} Endpoint settings, {(hasEndpoints ? "you maybe using ChattyStager as main web server" : "this maybe is a default settings file")}.");
            }
            catch { /* ignore */ }

            if (hasEndpoints)
            {
                File.WriteAllText(defaultFile, DefaultJsonContent);
                Console.WriteLine($"Generated file: {defaultFile}");
            }
        }
    }
}