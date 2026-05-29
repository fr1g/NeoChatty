namespace ChattyStager.Helpers;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

public sealed class CommandHelper : IDisposable
{
    private Process? _process;
    private readonly Channel<string> _outputChannel;
    private readonly CancellationTokenSource _processCts;
    private Task? _outputReaderTask;
    private readonly ConcurrentQueue<string> _allOutputLines = new();
    private bool _disposed;
    
    public IReadOnlyList<string> LatestOutputLines => _allOutputLines.ToArray();

    public IAsyncEnumerable<string> OutputStream => _outputChannel.Reader.ReadAllAsync();
    
    public bool IsRunning => _process is { HasExited: false };
    
    public event EventHandler? Exited;

    public CommandHelper()
    {
        _outputChannel = Channel.CreateUnbounded<string>();
        _processCts = new CancellationTokenSource();
    }
    
    public async Task StartAsync(string command, string? workingDirectory = null, CancellationToken cancellationToken = default)
    {
        if (IsRunning)
            throw new InvalidOperationException("Something is running");

        if (string.IsNullOrWhiteSpace(command))
            throw new ArgumentException("Empty Command", nameof(command));
        
        var startInfo = new ProcessStartInfo
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding = System.Text.Encoding.UTF8
        };

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            startInfo.FileName = "cmd.exe";
            startInfo.Arguments = $"/c \"{command}\"";
        }
        else
        {
            startInfo.FileName = "/bin/bash";
            startInfo.Arguments = $"-c \"{command}\"";
        }

        _process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        
        _process.Exited += (_, _) =>
        {
            Exited?.Invoke(this, EventArgs.Empty);
            _outputChannel.Writer.TryComplete();
        };

        // 启动进程
        _process.Start();

        // 开始异步读取输出流（合并 stdout 和 stderr）
        _outputReaderTask = Task.Run(() => ReadOutputStreamsAsync(_process, _outputChannel.Writer, _processCts.Token), cancellationToken);
        // return await ReadOutputStreamsAsync(_process, _outputChannel.Writer, _processCts.Token);
        await _process.WaitForExitAsync(cancellationToken);
        await _outputReaderTask;
    }
    
    
    public async Task StopAsync()
    {
        if (!IsRunning)
            return;
        try
        {
            _process?.Kill(true);
            _processCts.Cancel();
            if (_outputReaderTask != null)
                await _outputReaderTask.WaitAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"停止进程时出错: {ex.Message}");
        }
        finally
        {
            _process?.Dispose();
            _process = null;
            _outputChannel.Writer.TryComplete();
        }
    }

    private async Task ReadOutputStreamsAsync(Process process, ChannelWriter<string> writer, CancellationToken cancellationToken)
    {
        try
        {
            var stdoutTask = ReadStreamAsync(process.StandardOutput, writer, cancellationToken);
            var stderrTask = ReadStreamAsync(process.StandardError, writer, cancellationToken);

            await Task.WhenAll(stdoutTask, stderrTask);
            await process.WaitForExitAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            try { writer.TryWrite($"[ERR]:: {ex.Message}"); } catch { }
        }
        finally
        {
            writer.TryComplete();
        }
    }

    private async Task ReadStreamAsync(StreamReader reader, ChannelWriter<string> writer, CancellationToken cancellationToken)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(cancellationToken);
                if (line == null)
                    break;
                
                await writer.WriteAsync(line, cancellationToken);
                _allOutputLines.Enqueue(line);
                
                while (_allOutputLines.Count > 5000)
                    _allOutputLines.TryDequeue(out _);
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            try { writer.TryWrite($"[ERR] IN-STREAM: {ex.Message}"); } catch { }
        }
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _processCts.Cancel();
        _processCts.Dispose();
        _process?.Dispose();
        _outputChannel.Writer.TryComplete();
        _disposed = true;
    }
}