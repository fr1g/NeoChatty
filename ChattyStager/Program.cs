using ChattyStager.Components;
using TailwindBlazor;

var builder = WebApplication.CreateBuilder(args);

builder.UseTailwind();

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

var options = new DefaultFilesOptions();
options.DefaultFileNames.Clear();
options.DefaultFileNames.Add("index.html");
app.UseDefaultFiles(options);
app.UseStaticFiles();

app.MapWhen(ctx => ctx.Request.Path.StartsWithSegments("/stager"), blazorApp =>
{
    blazorApp.UsePathBase("/stager");
    blazorApp.UseStaticFiles();
    blazorApp.UseRouting();
    blazorApp.UseAntiforgery();    
    
    if (!app.Environment.IsDevelopment())
    {
        blazorApp.UseExceptionHandler("/Error", createScopeForErrors: true);
        blazorApp.UseHsts();
    }
    
    blazorApp.UseEndpoints(endpoints =>
    {
        endpoints.MapBlazorHub();
        endpoints.MapRazorComponents<App>()
            .AddInteractiveServerRenderMode();
    });
    
});

app.UseHttpsRedirection();

app.MapWhen(ctx => !ctx.Request.Path.StartsWithSegments("/stager"), nonBlazor =>
{
    nonBlazor.UseStatusCodePagesWithReExecute("/not-found");
});

app.Run();