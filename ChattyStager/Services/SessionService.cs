namespace ChattyStager.Services;

using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Components.Server.Circuits;
using ChattyStager.Model;

public class SessionService : CircuitHandler
{
    private static readonly ConcurrentDictionary<string, DateTime> _authenticatedCircuits = new();
    private static readonly TimeSpan SessionDuration = TimeSpan.FromHours(3);
    private readonly StagerConfig _config;

    public SessionService(StagerConfig config)
    {
        _config = config;
    }

    public bool IsAuthenticated(string circuitId)
    {
        if (string.IsNullOrEmpty(_config.PassKey))
            return true;

        if (!_authenticatedCircuits.TryGetValue(circuitId, out var authenticatedAt))
            return false;

        if (DateTime.UtcNow - authenticatedAt > SessionDuration)
        {
            _authenticatedCircuits.TryRemove(circuitId, out _);
            return false;
        }

        return true;
    }

    public bool Authenticate(string circuitId, string passKey)
    {
        if (string.IsNullOrEmpty(_config.PassKey))
            return true;

        if (_config.PassKey != passKey)
            return false;

        _authenticatedCircuits[circuitId] = DateTime.UtcNow;
        return true;
    }

    public void Deauthenticate(string circuitId)
    {
        _authenticatedCircuits.TryRemove(circuitId, out _);
    }

    public TimeSpan GetRemainingTime(string circuitId)
    {
        if (!_authenticatedCircuits.TryGetValue(circuitId, out var authenticatedAt))
            return TimeSpan.Zero;

        var remaining = SessionDuration - (DateTime.UtcNow - authenticatedAt);
        return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
    }

    public override Task OnCircuitClosedAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        var circuitId = circuit.Id;
        _authenticatedCircuits.TryRemove(circuitId, out _);
        return base.OnCircuitClosedAsync(circuit, cancellationToken);
    }
}

public class SessionStateProvider
{
    private readonly StagerConfig _config;

    public SessionStateProvider(StagerConfig config)
    {
        _config = config;
    }

    public string CircuitId { get; } = Guid.NewGuid().ToString("N");
    public bool NeedsSetup => !_config.IsSetUp;
    public bool IsConfigured => _config.IsSetUp;
}
