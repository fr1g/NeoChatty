namespace ChattyStager.Helpers;

using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using ChattyStager.Model;

/// <summary>
/// Database connection helper for MySQL/MariaDB operations
/// </summary>
public class DBConnectionHelper
{
    private static StagerConfig? _config;

    public static void Initialize(StagerConfig config)
    {
        _config = config;
    }

    /// <summary>
    /// Get connection string from current config
    /// </summary>
    public static string GetConnectionString()
    {
        if (_config == null)
            throw new InvalidOperationException("DBConnectionHelper not initialized. Call Initialize() first.");

        var connectionString = $"Server={_config.MySqlAddr};" +
                             $"Port={_config.MySqlPort};" +
                             $"Database={_config.MySqlDatabase};" +
                             $"Uid={_config.MySqlUser};" +
                             $"Pwd={_config.MySqlPass};" +
                             $"CharSet=utf8mb4;";
        return connectionString;
    }

    /// <summary>
    /// Test database connection
    /// </summary>
    public static async Task<(bool Success, string Message)> TestConnectionAsync()
    {
        try
        {
            using (var connection = new MySqlConnection(GetConnectionString()))
            {
                await connection.OpenAsync();
                return (true, "Database connection successful");
            }
        }
        catch (Exception ex)
        {
            return (false, $"Connection failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Execute SQL command (INSERT, UPDATE, DELETE)
    /// </summary>
    public static async Task<(bool Success, int AffectedRows, string Message)> ExecuteCommandAsync(string commandText, Dictionary<string, object>? parameters = null)
    {
        try
        {
            using (var connection = new MySqlConnection(GetConnectionString()))
            {
                await connection.OpenAsync();
                using (var command = new MySqlCommand(commandText, connection))
                {
                    if (parameters != null)
                    {
                        foreach (var param in parameters)
                        {
                            command.Parameters.AddWithValue($"@{param.Key}", param.Value ?? DBNull.Value);
                        }
                    }

                    int affectedRows = await command.ExecuteNonQueryAsync();
                    return (true, affectedRows, "Command executed successfully");
                }
            }
        }
        catch (Exception ex)
        {
            return (false, 0, $"Command execution failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Execute stored procedure
    /// </summary>
    public static async Task<(bool Success, DataTable? Data, string Message)> ExecuteStoredProcedureAsync(string procedureName, Dictionary<string, object>? parameters = null)
    {
        try
        {
            using (var connection = new MySqlConnection(GetConnectionString()))
            {
                await connection.OpenAsync();
                using (var command = new MySqlCommand(procedureName, connection))
                {
                    command.CommandType = CommandType.StoredProcedure;

                    if (parameters != null)
                    {
                        foreach (var param in parameters)
                        {
                            command.Parameters.AddWithValue($"@{param.Key}", param.Value ?? DBNull.Value);
                        }
                    }

                    using (var adapter = new MySqlDataAdapter(command))
                    {
                        var dataTable = new DataTable();
                        await Task.Run(() => adapter.Fill(dataTable));
                        return (true, dataTable, "Stored procedure executed successfully");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            return (false, null, $"Stored procedure execution failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Query data (SELECT)
    /// </summary>
    public static async Task<(bool Success, DataTable? Data, string Message)> QueryAsync(string commandText, Dictionary<string, object>? parameters = null)
    {
        try
        {
            using (var connection = new MySqlConnection(GetConnectionString()))
            {
                await connection.OpenAsync();
                using (var command = new MySqlCommand(commandText, connection))
                {
                    if (parameters != null)
                    {
                        foreach (var param in parameters)
                        {
                            command.Parameters.AddWithValue($"@{param.Key}", param.Value ?? DBNull.Value);
                        }
                    }

                    using (var adapter = new MySqlDataAdapter(command))
                    {
                        var dataTable = new DataTable();
                        await Task.Run(() => adapter.Fill(dataTable));
                        return (true, dataTable, "Query executed successfully");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            return (false, null, $"Query execution failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Execute scalar query (returns single value)
    /// </summary>
    public static async Task<(bool Success, object? Value, string Message)> ScalarAsync(string commandText, Dictionary<string, object>? parameters = null)
    {
        try
        {
            using (var connection = new MySqlConnection(GetConnectionString()))
            {
                await connection.OpenAsync();
                using (var command = new MySqlCommand(commandText, connection))
                {
                    if (parameters != null)
                    {
                        foreach (var param in parameters)
                        {
                            command.Parameters.AddWithValue($"@{param.Key}", param.Value ?? DBNull.Value);
                        }
                    }

                    var result = await command.ExecuteScalarAsync();
                    return (true, result, "Scalar query executed successfully");
                }
            }
        }
        catch (Exception ex)
        {
            return (false, null, $"Scalar query failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Initialize database from SQL file
    /// </summary>
    public static async Task<(bool Success, string Message)> InitializeDatabaseFromSqlFileAsync(string sqlFilePath)
    {
        try
        {
            if (!File.Exists(sqlFilePath))
                return (false, $"SQL file not found: {sqlFilePath}");

            var sqlContent = await File.ReadAllTextAsync(sqlFilePath);

            // Split by GO or `;` if needed
            var commands = sqlContent.Split(new[] { ";" }, StringSplitOptions.RemoveEmptyEntries);

            using (var connection = new MySqlConnection(GetConnectionString()))
            {
                await connection.OpenAsync();
                
                foreach (var commandText in commands)
                {
                    var trimmedCommand = commandText.Trim();
                    if (string.IsNullOrWhiteSpace(trimmedCommand))
                        continue;

                    using (var command = new MySqlCommand(trimmedCommand, connection))
                    {
                        command.CommandTimeout = 300; // 5 minutes timeout
                        try
                        {
                            await command.ExecuteNonQueryAsync();
                        }
                        catch (Exception ex)
                        {
                            // Continue with next command, log the error
                            Console.WriteLine($"Command execution warning: {ex.Message}");
                        }
                    }
                }
            }

            return (true, "Database initialization completed successfully");
        }
        catch (Exception ex)
        {
            return (false, $"Database initialization failed: {ex.Message}");
        }
    }
}