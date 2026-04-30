# Swagger API 文档

## 访问Swagger UI

启动开发服务器后，您可以通过以下地址访问Swagger UI文档：

### 本地访问

- **Swagger UI**: http://localhost:3000/api/docs
- **Swagger JSON**: http://localhost:3000/api/swagger.json

### 功能说明

#### 1. Swagger UI 界面 (`/api/docs`)

- 交互式的API文档界面
- 可以直接在浏览器中测试所有API端点
- 包含完整的请求/响应示例和数据结构

#### 2. Swagger JSON 文件 (`/api/swagger.json`)

- 获取原始的OpenAPI 3.0格式的JSON文件
- 可用于：
  - 在其他工具中导入（如Postman、Insomnia等）
  - 代码生成工具
  - 其他文档工具的集成

## 已包含的API分类

### 1. Authentication（身份验证）

- 用户注册
- 用户登录
- 令牌刷新
- 密码修改

### 2. Users（用户管理）

- 获取当前用户信息
- 更新用户信息
- 隐私设置管理
- 用户搜索
- 查看其他用户资料

### 3. Friends（好友管理）

- 发送好友请求
- 管理好友请求（接受/拒绝）
- 获取好友列表
- 删除好友

### 4. Conversations（会话管理）

- 获取所有会话

### 5. Messages（消息）

- 获取与特定好友的消息历史

### 6. Blocks（黑名单管理）

- 屏蔽用户
- 获取黑名单
- 取消屏蔽用户

### 7. Files（文件管理）

- 上传文件
- 下载文件

## 使用身份认证

大部分API端点需要JWT令牌认证。在Swagger UI中：

1. 先调用 `POST /auth/register` 或 `POST /auth/login` 获取 `accessToken`
2. 点击右上角的"Authorize"按钮
3. 在弹出的对话框中输入: `Bearer YOUR_ACCESS_TOKEN`
4. 点击"Authorize"按钮
5. 之后所有请求都会自动包含认证头

## 配置位置

Swagger配置文件位于：`src/swagger.ts`

各路由文件的JSDoc注释：

- `src/routes/auth.ts` - 身份验证路由
- `src/routes/users.ts` - 用户管理路由
- `src/routes/friends.ts` - 好友管理路由
- `src/routes/conversations.ts` - 会话管理路由
- `src/routes/messages.ts` - 消息路由
- `src/routes/blocks.ts` - 黑名单管理路由
- `src/routes/files.ts` - 文件管理路由

## 更新API文档

每当您修改路由中的JSDoc注释时，Swagger文档会自动更新。只需刷新浏览器即可看到新的文档。

## 开发服务器启动

```bash
pnpm dev
```

然后访问 http://localhost:3000/api/docs
