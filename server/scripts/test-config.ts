#!/usr/bin/env node
/**
 * 配置加载测试脚本
 * 用途：演示三层优先级的配置加载
 * 
 * 使用方法：
 * pnpm run test:config
 * 
 * 或带环境变量：
 * APP_PORT=8080 pnpm run test:config
 */

// 必须在加载其他模块前设置测试环境
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
}

import path from 'path';

// 测试用例
console.log('\n========================================');
console.log('Chatty 配置系统测试');
console.log('========================================\n');

console.log('当前工作目录:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('\n--- 环境变量 ---');
console.log('APP_PORT:', process.env.APP_PORT);
console.log('APP_DB_HOST:', process.env.APP_DB_HOST);
console.log('APP_DB_PASSWORD:', process.env.APP_DB_PASSWORD);

// 导入配置
import { getConfig, resetConfig } from '../src/config/index';
import { defaultConfig } from '../src/config/defaults';

console.log('\n--- 默认配置 ---');
console.log(JSON.stringify(defaultConfig, null, 2));

// 重置并加载配置
resetConfig();
const config = getConfig();

console.log('\n--- 最终配置 ---');
console.log(JSON.stringify(config, null, 2));

console.log('\n--- 配置验证 ---');
console.log('✓ PORT:', config.PORT, '(期望: 环境变量 > 配置文件 > 默认值)');
console.log('✓ DB.HOST:', config.DB.HOST);
console.log('✓ DB.USER:', config.DB.USER);
console.log('✓ DB.NAME:', config.DB.NAME);
console.log('✓ USE_HTTPS:', config.USE_HTTPS);

console.log('\n========================================');
console.log('测试完成');
console.log('========================================\n');

// 演示测试命令
console.log('测试命令示例：');
console.log('1. 默认配置:');
console.log('   pnpm run test:config');
console.log('\n2. 修改 PORT:');
console.log('   APP_PORT=9000 pnpm run test:config');
console.log('\n3. 修改数据库配置:');
console.log('   APP_DB_HOST=prod-db.example.com APP_DB_USER=admin pnpm run test:config');
console.log('\n');
