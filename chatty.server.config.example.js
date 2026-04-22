/**
 * Chatty 服务器配置文件
 * 
 * 使用说明：
 * 1. 在项目根目录创建此文件 (chatty.server.config.js)
 * 2. 配置优先级 (高到低):
 *    - 环境变量 (APP_* 格式) - 最高优先级
 *    - 此配置文件内容
 *    - 默认配置 - 最低优先级
 * 3. 重启服务器使配置生效
 * 
 * 环境变量对应关系:
 * - APP_USE_HTTPS=true/false
 * - APP_PORT=5637
 * - APP_DB_NAME=chatty
 * - APP_DB_USER=root
 * - APP_DB_PASSWORD=password
 * - APP_DB_HOST=localhost
 * - APP_DB_PORT=3306
 */

module.exports = {
  // 应用配置
  USE_HTTPS: false,
  PORT: 5637,
  
  // 数据库配置
  DB: {
    NAME: 'chatty',
    USER: 'root',
    PASSWORD: '7355608',
    HOST: 'localhost',
    PORT: 3306,
  },
  
  // 可扩展: 在此添加其他配置
  // EXAMPLE: FEATURE_FLAG: true,
};
