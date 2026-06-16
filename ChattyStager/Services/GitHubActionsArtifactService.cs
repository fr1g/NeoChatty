namespace ChattyStager.Services;

using ChattyStager.Model;
using System.Net.Http.Headers;
using System.Text.Json;

public class GitHubActionsArtifactService
{
    private readonly HttpClient _httpClient;

    public GitHubActionsArtifactService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ArtifactInfo> FindLatestSuccessfulArtifactAsync(
        StagerConfig config,
        string artifactName,
        List<OperationLogEntry> logs,
        CancellationToken cancellationToken = default)
    {
        var artifacts = await FindLatestBuildArtifactsAsync(logs, cancellationToken);
        if (string.Equals(artifactName, GitHubArtifactConstants.ServerArtifactName, StringComparison.OrdinalIgnoreCase))
            return artifacts.Server;
        if (string.Equals(artifactName, GitHubArtifactConstants.WebappArtifactName, StringComparison.OrdinalIgnoreCase))
            return artifacts.Webapp;
        throw new InvalidOperationException($"Unsupported artifact `{artifactName}`.");
    }

    public async Task<(ArtifactInfo Server, ArtifactInfo Webapp)> FindLatestBuildArtifactsAsync(
        List<OperationLogEntry> logs,
        CancellationToken cancellationToken = default)
    {
        logs.Add(new OperationLogEntry(DateTimeOffset.Now, "info", $"Finding `{GitHubArtifactConstants.ServerArtifactName}` and `{GitHubArtifactConstants.WebappArtifactName}` from latest public release assets."));

        using var releasesDoc = await GetJsonAsync(GitHubArtifactConstants.RepositoryReleasesUrl, cancellationToken);
        var releases = releasesDoc.RootElement.EnumerateArray().ToList();
        if (releases.Count == 0)
            throw new InvalidOperationException("No GitHub releases were found.");

        // Find the release with the most recent created_at that contains both required assets.
        JsonElement? bestRelease = null;
        DateTimeOffset bestCreatedAt = DateTimeOffset.MinValue;
        ArtifactInfo? bestServer = null;
        ArtifactInfo? bestWebapp = null;

        foreach (var release in releases)
        {
            if (!release.TryGetProperty("created_at", out var createdAtElement))
                continue;

            var createdAt = createdAtElement.GetDateTimeOffset();
            if (createdAt <= bestCreatedAt)
                continue;

            // Try to match required assets within this release.
            ArtifactInfo? server = null;
            ArtifactInfo? webapp = null;

            if (release.TryGetProperty("assets", out var assetsElement))
            {
                foreach (var asset in assetsElement.EnumerateArray())
                {
                    var name = asset.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
                    if (name == null)
                        continue;

                    if (server == null && string.Equals(name, GitHubArtifactConstants.ServerArtifactName, StringComparison.OrdinalIgnoreCase))
                        server = CreateArtifactInfo(asset);
                    else if (webapp == null && string.Equals(name, GitHubArtifactConstants.WebappArtifactName, StringComparison.OrdinalIgnoreCase))
                        webapp = CreateArtifactInfo(asset);

                    if (server != null && webapp != null)
                        break;
                }
            }

            if (server != null && webapp != null)
            {
                bestRelease = release;
                bestCreatedAt = createdAt;
                bestServer = server;
                bestWebapp = webapp;
            }
        }

        if (bestRelease == null)
            throw new InvalidOperationException($"No release contains both `{GitHubArtifactConstants.ServerArtifactName}` and `{GitHubArtifactConstants.WebappArtifactName}` assets.");

        var releaseName = bestRelease.Value.TryGetProperty("name", out var nameElement) ? nameElement.GetString() : null;
        var releaseTag = bestRelease.Value.TryGetProperty("tag_name", out var tagElement) ? tagElement.GetString() : null;
        logs.Add(new OperationLogEntry(DateTimeOffset.Now, "info", $"Using release `{releaseName ?? releaseTag ?? "latest"}` (created {bestCreatedAt:O})."));

        logs.Add(new OperationLogEntry(DateTimeOffset.Now, "info", $"Matched artifact `{bestServer!.Name}` ({bestServer.SizeInBytes} bytes)."));
        logs.Add(new OperationLogEntry(DateTimeOffset.Now, "info", $"Matched artifact `{bestWebapp!.Name}` ({bestWebapp.SizeInBytes} bytes)."));

        return (bestServer, bestWebapp);
    }

    public async Task<string> DownloadArtifactAsync(
        StagerConfig config,
        ArtifactInfo artifact,
        string targetDirectory,
        List<OperationLogEntry> logs,
        CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(targetDirectory);
        var targetPath = Path.Combine(targetDirectory, $"{artifact.Name}.{artifact.Id}.zip");
        logs.Add(new OperationLogEntry(DateTimeOffset.Now, "info", $"Downloading artifact `{artifact.Name}`."));

        using var request = CreateRequest(artifact.ArchiveDownloadUrl);
        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
        await using var output = File.Create(targetPath);
        await input.CopyToAsync(output, cancellationToken);

        logs.Add(new OperationLogEntry(DateTimeOffset.Now, "info", $"Saved artifact to {targetPath}."));
        return targetPath;
    }

    private async Task<JsonDocument> GetJsonAsync(string url, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(url);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
    }

    private static HttpRequestMessage CreateRequest(string url)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.UserAgent.ParseAdd("ChattyStager/1.0");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        return request;
    }

    private static ArtifactInfo CreateArtifactInfo(JsonElement artifact)
    {
        return new ArtifactInfo(
            artifact.GetProperty("id").GetInt64(),
            artifact.GetProperty("name").GetString() ?? "",
            artifact.GetProperty("browser_download_url").GetString() ?? "",
            artifact.TryGetProperty("size", out var size) ? size.GetInt64() : 0,
            artifact.GetProperty("created_at").GetDateTimeOffset(),
            artifact.TryGetProperty("updated_at", out var updatedAt) ? updatedAt.GetDateTimeOffset() : artifact.GetProperty("created_at").GetDateTimeOffset());
    }
}
