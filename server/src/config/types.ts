/**
 * 应用配置类型定义
 */
export interface DatabaseConfig {
    NAME: string;
    USER: string;
    PASSWORD: string;
    HOST: string;
    PORT: number;
}

export interface AppConfig {
    USE_HTTPS: boolean;
    PORT: number;
    DB: DatabaseConfig;
    MOTD: string;
    INFO: string;
    [key: string]: any;
}
