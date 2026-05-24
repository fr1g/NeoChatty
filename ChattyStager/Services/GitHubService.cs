namespace ChattyStager.Services;

using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

public class GitHubArtifactInfo
{
    public string Name { get; set; } = "";
    public long Size { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class GitHubWorkflowRun
{
    public long Id { get; set; }
    public string Status { get; set; } = "";
    public string Conclusion { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public long[] ArtifactIds { get; set; } = Array.Empty<long>();
}

public class DownloadProgressEventArgs : EventArgs
{
    public string CurrentFile { get; set; } = "";
    public int Percentage { get; set; }
    public long BytesDownloaded { get; set; }
    public long TotalBytes { get; set; }
    public string StatusMessage { get; set; } = "";
}

public class GitHubService
{
    private readonly HttpClient _httpClient;
    private const string Owner = "fr1g";
    private const string Repo = "NeoChatty";

    public event EventHandler<DownloadProgressEventArgs>? ProgressChanged;

    public GitHubService()
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("ChattyStager/1.0");
    }

    public async Task<(bool success, string message, List<GitHubArtifactInfo> artifacts)> ListArtifactsAsync()
    {
        try
        {
            var url = $"https://api.github.com/repos/{Owner}/{Repo}/actions/artifacts?per_page=10";
            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
                return (false, $"GitHub API returned {response.StatusCode}", new List<GitHubArtifactInfo>());

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var artifacts = new List<GitHubArtifactInfo>();

            foreach (var item in doc.RootElement.GetProperty("artifacts").EnumerateArray())
            {
                artifacts.Add(new GitHubArtifactInfo
                {
                    Name = item.GetProperty("name").GetString() ?? "",
                    Size = item.GetProperty("size_in_bytes").GetInt64(),
                    CreatedAt = item.GetProperty("created_at").GetDateTime()
                });
            }

            return (true, $"Found {artifacts.Count} artifacts", artifacts);
        }
        catch (Exception ex)
        {
            return (false, $"Error: {ex.Message}", new List<GitHubArtifactInfo>());
        }
    }

    public async Task<(bool success, string message)> DownloadAndExtractArtifactAsync(
        string artifactName, string extractPath, IProgress<DownloadProgressEventArgs>? progress = null)
    {
        try
        {
            progress?.Report(new DownloadProgressEventArgs
            {
                StatusMessage = "Finding latest successful workflow run..."
            });

            var runsUrl = $"https://api.github.com/repos/{Owner}/{Repo}/actions/runs?status=success&per_page=5";
            var runsResponse = await _httpClient.GetAsync(runsUrl);
            if (!runsResponse.IsSuccessStatusCode)
                return (false, $"Failed to get workflow runs: {runsResponse.StatusCode}");

            var runsJson = await runsResponse.Content.ReadAsStringAsync();
            using var runsDoc = JsonDocument.Parse(runsJson);
            long? targetRunId = null;

            foreach (var run in runsDoc.RootElement.GetProperty("workflow_runs").EnumerateArray())
            {
                if (run.GetProperty("conclusion").GetString() == "success")
                {
                    targetRunId = run.GetProperty("id").GetInt64();
                    break;
                }
            }

            if (targetRunId == null)
                return (false, "No successful workflow runs found");

            progress?.Report(new DownloadProgressEventArgs
            {
                StatusMessage = $"Finding artifact '{artifactName}' from run #{targetRunId}..."
            });

            var artifactsUrl = $"https://api.github.com/repos/{Owner}/{Repo}/actions/runs/{targetRunId}/artifacts";
            var artifactsResponse = await _httpClient.GetAsync(artifactsUrl);
            if (!artifactsResponse.IsSuccessStatusCode)
                return (false, $"Failed to list artifacts: {artifactsResponse.StatusCode}");

            var artifactsJson = await artifactsResponse.Content.ReadAsStringAsync();
            using var artifactsDoc = JsonDocument.Parse(artifactsJson);
            long? targetArtifactId = null;

            foreach (var artifact in artifactsDoc.RootElement.GetProperty("artifacts").EnumerateArray())
            {
                if (artifact.GetProperty("name").GetString() == artifactName)
                {
                    targetArtifactId = artifact.GetProperty("id").GetInt64();
                    break;
                }
            }

            if (targetArtifactId == null)
                return (false, $"Artifact '{artifactName}' not found in latest successful run");

            progress?.Report(new DownloadProgressEventArgs
            {
                StatusMessage = $"Downloading '{artifactName}' (this may take a while)..."
            });

            var downloadUrl = $"https://api.github.com/repos/{Owner}/{Repo}/actions/artifacts/{targetArtifactId}/zip";
            using var downloadResponse = await _httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead);
            if (!downloadResponse.IsSuccessStatusCode)
                return (false, $"Failed to download artifact: {downloadResponse.StatusCode}");

            var totalBytes = downloadResponse.Content.Headers.ContentLength ?? -1;
            var tempZipPath = Path.Combine(Path.GetTempPath(), $"{artifactName}_{Guid.NewGuid()}.zip");

            try
            {
                using (var contentStream = await downloadResponse.Content.ReadAsStreamAsync())
                using (var fileStream = new FileStream(tempZipPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    var buffer = new byte[81920];
                    long bytesRead = 0;
                    int read;
                    while ((read = await contentStream.ReadAsync(buffer)) > 0)
                    {
                        await fileStream.WriteAsync(buffer, 0, read);
                        bytesRead += read;
                        if (totalBytes > 0)
                        {
                            var percent = (int)(bytesRead * 100 / totalBytes);
                            progress?.Report(new DownloadProgressEventArgs
                            {
                                CurrentFile = artifactName,
                                BytesDownloaded = bytesRead,
                                TotalBytes = totalBytes,
                                Percentage = percent,
                                StatusMessage = $"Downloading... {percent}%"
                            });
                        }
                    }
                }

                progress?.Report(new DownloadProgressEventArgs
                {
                    StatusMessage = $"Extracting to {extractPath}..."
                });

                if (Directory.Exists(extractPath))
                {
                    Directory.Delete(extractPath, true);
                }
                Directory.CreateDirectory(extractPath);

                ZipFile.ExtractToDirectory(tempZipPath, extractPath);

                progress?.Report(new DownloadProgressEventArgs
                {
                    StatusMessage = $"Completed: {artifactName} extracted to {extractPath}"
                });

                return (true, $"Successfully downloaded and extracted '{artifactName}'");
            }
            finally
            {
                if (File.Exists(tempZipPath))
                    File.Delete(tempZipPath);
            }
        }
        catch (Exception ex)
        {
            return (false, $"Error: {ex.Message}");
        }
    }
}
