import path from 'path';
import fs from 'fs';
import { AppConfig } from './types';
import { defaultConfig } from './defaults';

function isObject(item: any): item is Record<string, any> {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * 生成配置文件内容
 */
function generateConfigFileContent(): string {
    const config = {
        USE_HTTPS: defaultConfig.USE_HTTPS,
        PORT: defaultConfig.PORT,
        DB: {
            NAME: defaultConfig.DB.NAME,
            USER: defaultConfig.DB.USER,
            PASSWORD: defaultConfig.DB.PASSWORD,
            HOST: defaultConfig.DB.HOST,
            PORT: defaultConfig.DB.PORT,
        },
        MOTD: defaultConfig.MOTD,
        INFO: defaultConfig.INFO,
    };

    return `
module.exports = ${JSON.stringify(config, null, 2)};
`;
}

/**
 * 尝试在指定目录创建配置文件
 */
function tryCreateConfigFile(configPath: string): boolean {
    try {
        // 检查目录是否存在，不存在则创建
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 创建配置文件
        const content = generateConfigFileContent();
        fs.writeFileSync(configPath, content, 'utf-8');
        return true;
    } catch (error) {
        console.warn(
            `[CONFIG] Failed to init config file: (${configPath}):`,
            error instanceof Error ? error.message : String(error)
        );
        return false;
    }
}

/**
 * 深度合并对象，后面的值覆盖前面的值
 */
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const output: Record<string, any> = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach((key) => {
            if (isObject(source[key]) && isObject(target[key])) {
                output[key] = deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        });
    }
    return output;
}

/**
 * 从环境变量读取配置
 * 支持以下格式：
 * - APP_USE_HTTPS=true
 * - APP_PORT=5637
 * - APP_DB_NAME=chatty
 * - APP_DB_USER=root
 * - APP_DB_PASSWORD=password
 * - APP_DB_HOST=localhost
 * - APP_DB_PORT=3306
 */
function loadFromEnv(): Partial<AppConfig> {
    const envConfig: any = {};

    // 处理顶级配置
    if (process.env.APP_USE_HTTPS !== undefined) {
        envConfig.USE_HTTPS = process.env.APP_USE_HTTPS === 'true';
    }
    if (process.env.APP_PORT !== undefined) {
        envConfig.PORT = parseInt(process.env.APP_PORT, 10);
    }

    // 处理数据库配置
    if (
        process.env.APP_DB_NAME ||
        process.env.APP_DB_USER ||
        process.env.APP_DB_PASSWORD ||
        process.env.APP_DB_HOST ||
        process.env.APP_DB_PORT
    ) {
        envConfig.DB = {};
        if (process.env.APP_DB_NAME !== undefined) {
            envConfig.DB.NAME = process.env.APP_DB_NAME;
        }
        if (process.env.APP_DB_USER !== undefined) {
            envConfig.DB.USER = process.env.APP_DB_USER;
        }
        if (process.env.APP_DB_PASSWORD !== undefined) {
            envConfig.DB.PASSWORD = process.env.APP_DB_PASSWORD;
        }
        if (process.env.APP_DB_HOST !== undefined) {
            envConfig.DB.HOST = process.env.APP_DB_HOST;
        }
        if (process.env.APP_DB_PORT !== undefined) {
            envConfig.DB.PORT = parseInt(process.env.APP_DB_PORT, 10);
        }
    }

    return envConfig;
}

/**
 * 从配置文件读取配置
 * 如果不存在，则根据默认配置自动创建一个
 */
function loadFromConfigFile(): Partial<AppConfig> {
    const possiblePaths = [
        path.resolve(process.cwd(), 'chatty.server.config.js'),
        path.resolve(process.cwd(), '..', 'chatty.server.config.js'),
        path.resolve(__dirname, '../../chatty.server.config.js'),
        path.resolve(__dirname, '../../../chatty.server.config.js'),
    ];

    // 首先尝试查找现有配置文件
    for (const configPath of possiblePaths) {
        try {
            if (fs.existsSync(configPath)) {
                // 清除 require 缓存，确保每次都重新加载
                delete require.cache[require.resolve(configPath)];
                const config = require(configPath);
                return config.default || config;
            }
        } catch (error) {
            console.warn(
                `[CONFIG] Unable to load config. Chatty is using Default Config to startup. (${configPath}):`,
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    // 如果没有找到配置文件，尝试在第一个可能的位置创建一个
    const primaryPath = possiblePaths[0];

    if (tryCreateConfigFile(primaryPath)) {
        try {
            // 创建成功后立即加载
            delete require.cache[require.resolve(primaryPath)];
            const config = require(primaryPath);
            return config.default || config;
        } catch (error) {
            console.warn(
                `[CONFIG] Unable to load config. Chatty is using Default Config to startup. (${primaryPath}):`,
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    return {};
}

/**
 * 加载应用配置
 * 优先级从高到低：
 * 1. 环境变量 (APP_*)
 * 2. chatty.server.config.js 配置文件 (如果不存在则自动创建)
 * 3. 默认配置
 */
function loadConfig(): AppConfig {
    console.log('[CONFIG] Loading Config...');

    // 第一步：加载默认配置
    let config: any = { ...defaultConfig };
    console.log('[CONFIG] Read Default Config');

    // 第二步：加载配置文件并合并 (如果不存在则自动创建)
    const fileConfig = loadFromConfigFile();
    if (Object.keys(fileConfig).length > 0) {
        config = deepMerge(config, fileConfig);
        console.log('[CONFIG] Found Valid Config File and Read Config File');
    }

    // 第三步：加载环境变量并合并（最高优先级）
    const envConfig = loadFromEnv();
    if (Object.keys(envConfig).length > 0) {
        config = deepMerge(config, envConfig);
        console.log('[CONFIG] Read ENV');
    }

    console.log('[CONFIG] Chatty has configured abiding ENV>Config File>Default Config.');
    return config as AppConfig;
}

/**
 * 单例模式：全局配置实例
 */
let appConfig: AppConfig | null = null;

/**
 * 获取应用配置
 * 如果尚未加载，则自动加载配置
 */
export function getConfig(): AppConfig {
    if (!appConfig) {
        appConfig = loadConfig();
    }
    return appConfig;
}

/**
 * 重置配置（主要用于测试）
 */
export function resetConfig(): void {
    appConfig = null;
}

/**
 * 手动创建配置文件
 * 如果文件已存在则不会覆盖
 * @param targetPath - 配置文件路径，默认为项目根目录的 chatty.server.config.js
 * @returns 是否成功创建
 */
export function createConfigFile(targetPath?: string): boolean {
    const configPath = targetPath || path.resolve(process.cwd(), 'chatty.server.config.js');
    if (fs.existsSync(configPath))
        return false;
    return tryCreateConfigFile(configPath);
}

/**
 * 导出配置单例
 */
export default getConfig();
