import { AppConfig } from './types';

/**
 * 默认配置
 * 优先级最低，可被 chatty.server.config.js 和环境变量覆盖
 */
export const defaultConfig: AppConfig = {
    USE_HTTPS: false,
    PORT: 5637,
    DB: {
        NAME: 'chatty',
        USER: 'root',
        PASSWORD: '7355608',
        HOST: 'localhost',
        PORT: 3306,
    },
    MOTD: `Chatty Default MOTD - %datetime% - %info%`,
    INFO: 'default chatty server presented.'
};

export default defaultConfig;
