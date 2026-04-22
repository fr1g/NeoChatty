using ChattyStager.Components;
using TailwindBlazor;

var builder = WebApplication.CreateBuilder(args);

builder.UseTailwind();

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

app.UseHttpsRedirection();

app.UseDefaultFiles(new DefaultFilesOptions
{
    DefaultFileNames = { "index.html" }
});
app.UseStaticFiles();

app.Map("/stager", stager =>
{
    stager.UsePathBase("/stager");
    stager.UseStaticFiles();
    stager.UseRouting();
    stager.UseAntiforgery();

    if (!app.Environment.IsDevelopment())
    {
        stager.UseExceptionHandler("/Error", createScopeForErrors: true);
        stager.UseHsts();
    }

    stager.UseEndpoints(endpoints =>
    {
        endpoints.MapBlazorHub();
        endpoints.MapRazorComponents<App>()
            .AddInteractiveServerRenderMode();
    });
});

app.MapWhen(
    context => (!context.Request.Path.StartsWithSegments("/stager")),
    chattyWeb =>
    {
        var defaultFilesOptions = new DefaultFilesOptions();
        defaultFilesOptions.DefaultFileNames.Clear();
        defaultFilesOptions.DefaultFileNames.Add("index.html");
        chattyWeb.UseDefaultFiles(defaultFilesOptions);

        chattyWeb.UseStaticFiles();

        chattyWeb.Run(async context =>
        {
            context.Response.ContentType = "text/html";
            await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "index.html"));
        });
    });

app.Run();