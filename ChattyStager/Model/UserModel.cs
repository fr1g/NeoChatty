namespace ChattyStager.Model;

using System;
using System.Collections.Generic;
using System.Data;

/// <summary>
/// 用户数据模型，对应数据库 users 表
/// </summary>
public class UserModel
{
    /// <summary>
    /// 用户ID (主键)
    /// </summary>
    public uint Id { get; set; }

    /// <summary>
    /// 用户名 (唯一)
    /// </summary>
    public string Username { get; set; } = null!;

    /// <summary>
    /// 显示名称
    /// </summary>
    public string DisplayName { get; set; } = null!;

    /// <summary>
    /// 密码哈希值
    /// </summary>
    public string PasswordHash { get; set; } = null!;

    /// <summary>
    /// 头像定位符
    /// </summary>
    public string? AvatarLocator { get; set; }

    /// <summary>
    /// 背景定位符
    /// </summary>
    public string? BackgroundLocator { get; set; }

    /// <summary>
    /// 令牌版本号
    /// </summary>
    public uint TokenVersion { get; set; }

    /// <summary>
    /// 创建时间
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// 更新时间
    /// </summary>
    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// 禁用状态
    /// </summary>
    public bool Disabled { get; set; }

    /// <summary>
    /// 从 DataRow 创建 UserModel 对象
    /// </summary>
    /// <param name="row">DataRow 对象</param>
    /// <returns>UserModel 实例</returns>
    public static UserModel FromDataRow(DataRow row)
    {
        return new UserModel
        {
            Id = Convert.ToUInt32(row["id"]),
            Username = row["username"].ToString() ?? string.Empty,
            DisplayName = row["display_name"].ToString() ?? string.Empty,
            PasswordHash = row["password_hash"].ToString() ?? string.Empty,
            AvatarLocator = row["avatar_locator"] != DBNull.Value ? row["avatar_locator"].ToString() : null,
            BackgroundLocator = row["background_locator"] != DBNull.Value ? row["background_locator"].ToString() : null,
            TokenVersion = Convert.ToUInt32(row["token_version"]),
            CreatedAt = Convert.ToDateTime(row["created_at"]),
            UpdatedAt = Convert.ToDateTime(row["updated_at"]),
            Disabled = row["disabled"] != DBNull.Value && Convert.ToBoolean(row["disabled"])
        };
    }

    /// <summary>
    /// 从字典创建 UserModel 对象
    /// </summary>
    /// <param name="data">包含用户数据的字典</param>
    /// <returns>UserModel 实例</returns>
    public static UserModel FromDictionary(Dictionary<string, object?> data)
    {
        return new UserModel
        {
            Id = data.ContainsKey("id") ? Convert.ToUInt32(data["id"]) : 0,
            Username = data.ContainsKey("username") ? data["username"]?.ToString() ?? string.Empty : string.Empty,
            DisplayName = data.ContainsKey("display_name") ? data["display_name"]?.ToString() ?? string.Empty : string.Empty,
            PasswordHash = data.ContainsKey("password_hash") ? data["password_hash"]?.ToString() ?? string.Empty : string.Empty,
            AvatarLocator = data.ContainsKey("avatar_locator") && data["avatar_locator"] != null ? data["avatar_locator"]?.ToString() : null,
            BackgroundLocator = data.ContainsKey("background_locator") && data["background_locator"] != null ? data["background_locator"]?.ToString() : null,
            TokenVersion = data.ContainsKey("token_version") ? Convert.ToUInt32(data["token_version"]) : 0,
            CreatedAt = data.ContainsKey("created_at") ? Convert.ToDateTime(data["created_at"]) : DateTime.Now,
            UpdatedAt = data.ContainsKey("updated_at") ? Convert.ToDateTime(data["updated_at"]) : DateTime.Now,
            Disabled = data.ContainsKey("disabled") && data["disabled"] != null ? Convert.ToBoolean(data["disabled"]) : false
        };
    }

    /// <summary>
    /// 从匿名对象创建 UserModel 对象 (支持 Dapr 和其他 ORM 工具)
    /// </summary>
    /// <param name="record">包含用户数据的对象</param>
    /// <returns>UserModel 实例</returns>
    public static UserModel FromObject(object record)
    {
        if (record is UserModel userModel)
        {
            return userModel;
        }

        var type = record.GetType();
        var properties = type.GetProperties();
        var data = new Dictionary<string, object?>();

        foreach (var prop in properties)
        {
            data[prop.Name] = prop.GetValue(record);
        }

        return FromDictionary(data);
    }

    /// <summary>
    /// 将 UserModel 转换为字典
    /// </summary>
    /// <returns>包含用户数据的字典</returns>
    public Dictionary<string, object?> ToDictionary()
    {
        return new Dictionary<string, object?>
        {
            { "id", Id },
            { "username", Username },
            { "display_name", DisplayName },
            { "password_hash", PasswordHash },
            { "avatar_locator", AvatarLocator },
            { "background_locator", BackgroundLocator },
            { "token_version", TokenVersion },
            { "created_at", CreatedAt },
            { "updated_at", UpdatedAt },
            { "disabled", Disabled }
        };
    }
}