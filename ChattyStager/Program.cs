using System.Text;
using ChattyStager.Components;
using ChattyStager.Helpers;
using ChattyStager.Services;
using TailwindBlazor;

string[] protectedRoutes = ["/", "/Setup", "/Settings", "/ManageUser", "/Error", "/not-found", "/Lock"];

AppSettingsHelper.AppSettingsCheck();
Environment.SetEnvironmentVariable("DOTNET_hostBuilder__reloadConfigOnChange", "false");
Environment.SetEnvironmentVariable("ASPNETCORE_hostBuilder__reloadConfigOnChange", "false");

var builder = WebApplication.CreateBuilder(args);

builder.UseTailwind();

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();
builder.Services.AddHttpClient<GitHubActionsArtifactService>();
builder.Services.AddHttpClient<BackendSupervisorService>();
builder.Services.AddSingleton<StagerConfigService>();
builder.Services.AddSingleton<SystemInspectionService>();
builder.Services.AddSingleton<DatabaseSetupService>();
builder.Services.AddSingleton<ArtifactDeploymentService>();
builder.Services.AddSingleton<DashboardMetricsService>();

var app = builder.Build();

app.UseHttpsRedirection();

app.UseDefaultFiles(new DefaultFilesOptions
{
    DefaultFileNames = { "index.html" }
});


app.UseStaticFiles();

app.MapWhen(ctx => !ctx.Request.Path.StartsWithSegments("/stager"), spaBranch =>
{
    spaBranch.UseRouting();
    spaBranch.UseEndpoints(endpoints =>
    {
        endpoints.MapFallbackToFile("index.html");
    });
});

app.MapWhen(ctx => ctx.Request.Path.StartsWithSegments("/stager"), stagerBranch =>
{
    var configService = stagerBranch.ApplicationServices.GetRequiredService<StagerConfigService>();

    stagerBranch.UsePathBase("/stager");

    // --- Login endpoint (POST, must run before auth middleware) ---
    stagerBranch.MapWhen(ctx =>
        ctx.Request.Method == "POST" &&
        (ctx.Request.Path.Value?.EndsWith("/login", StringComparison.OrdinalIgnoreCase) == true),
        loginBranch =>
    {
        loginBranch.Run(async (ctx) =>
        {
            var form = await ctx.Request.ReadFormAsync();
            var passkey = form["passkey"].FirstOrDefault() ?? "";

            var config = await configService.LoadAsync();

            if (string.IsNullOrWhiteSpace(config.PassKey) || passkey != config.PassKey)
            {
                ctx.Response.Redirect($"/stager/Login?Error={Uri.EscapeDataString("Invalid passkey.")}");
                return;
            }

            var expiry = DateTimeOffset.UtcNow.AddHours(1);
            ctx.Response.Cookies.Append("stager_auth",
                Convert.ToBase64String(Encoding.UTF8.GetBytes(expiry.ToUnixTimeSeconds().ToString())),
                new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Strict,
                    Expires = expiry,
                    Path = "/stager",
                });

            ctx.Response.Redirect("/stager/");
        });
    });

    // --- Logout endpoint (POST, must run before auth middleware) ---
    stagerBranch.MapWhen(ctx =>
        ctx.Request.Method == "POST" &&
        (ctx.Request.Path.Value?.EndsWith("/logout", StringComparison.OrdinalIgnoreCase) == true),
        logoutBranch =>
    {
        logoutBranch.Run(async (ctx) =>
        {
            ctx.Response.Cookies.Delete("stager_auth", new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Strict,
                Path = "/stager",
            });

            ctx.Response.Redirect("/stager/Login");
            await Task.CompletedTask;
        });
    });

    // --- Auth middleware ---
    stagerBranch.Use(async (ctx, next) =>
    {
        var path = ctx.Request.Path.Value ?? "";

        var normalized = path.TrimEnd('/');

        if (normalized.EndsWith("/Login", StringComparison.OrdinalIgnoreCase))
        {
            await next();
            return;
        }

        var config = await configService.LoadAsync();
        if (!config.IsSetUp && normalized.EndsWith("/Setup", StringComparison.OrdinalIgnoreCase))
        {
            await next();
            return;
        }

        // Path is already stripped of /stager by UsePathBase
        var isProtected = protectedRoutes.Any(r => normalized.EndsWith(r, StringComparison.OrdinalIgnoreCase))
                          || normalized == "/" || normalized == "";
        if ((!isProtected) || (ctx.Request.Cookies.TryGetValue("stager_auth", out var cookieValue) &&
                               TryValidateAuthCookie(cookieValue)))
        {
            await next();
            return;
        }

        // Not set up → setup; otherwise → login
        if (!config.IsSetUp)
            ctx.Response.Redirect("/stager/Setup");
        else
            ctx.Response.Redirect("/stager/Login");
    });

    stagerBranch.UseStaticFiles();
    stagerBranch.UseRouting();
    stagerBranch.UseAntiforgery();

    stagerBranch.UseEndpoints(endpoints =>
    {

        endpoints.MapRazorComponents<App>()
            .AddInteractiveServerRenderMode();
    });
});

static bool TryValidateAuthCookie(string cookieValue)
{
    try
    {
        var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(cookieValue));
        if (long.TryParse(decoded, out var expirySeconds))
        {
            var expiry = DateTimeOffset.FromUnixTimeSeconds(expirySeconds);
            return expiry > DateTimeOffset.UtcNow;
        }
    }
    catch
    {
        // invalid cookie — reject
    }
    return false;
}

//
// app.UseStaticFiles();
//
// app.Map("/stager", stager =>
// {
//     stager.UsePathBase("/stager");
//     stager.UseStaticFiles();
//     stager.UseRouting();
//     stager.UseAntiforgery();
//
//     if (!app.Environment.IsDevelopment())
//     {
//         stager.UseExceptionHandler("/Error", createScopeForErrors: true);
//         stager.UseHsts();
//     }
//
//     stager.UseEndpoints(endpoints =>
//     {
//         endpoints.MapBlazorHub();
//         endpoints.MapRazorComponents<App>()
//             .AddInteractiveServerRenderMode();
//     });
// });
//
// app.MapWhen(
//     context => (!context.Request.Path.StartsWithSegments("/stager")),
//     chattyWeb =>
//     {
//         var defaultFilesOptions = new DefaultFilesOptions();
//         defaultFilesOptions.DefaultFileNames.Clear();
//         defaultFilesOptions.DefaultFileNames.Add("index.html");
//         chattyWeb.UseDefaultFiles(defaultFilesOptions);
//
//         chattyWeb.UseStaticFiles();
//
//         chattyWeb.Run(async context =>
//         {
//             context.Response.ContentType = "text/html";
//             await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "index.html"));
//         });
//     });

app.Run();
