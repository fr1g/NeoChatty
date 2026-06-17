# chatty-sdk

Shared client SDK for the Chatty instant messaging platform. Provides REST API calls and Socket.IO real-time communication.

## Installation

```bash
npm install chatty-sdk
```

## Quick Start

The SDK supports both **synchronous** (browser localStorage) and **asynchronous** (React Native SecureStore) initialization.

### Browser (sync)

```ts
import {
    ChattyClient,
    ChattyClientConfig,
    DEFAULT_CLIENT_CONFIG,
    ConstructClient,
} from 'chatty-sdk';

// 1. Prepare storage adapters
const setter = (key: string, value: string) => localStorage.setItem(key, value);
const getter = (key: string) => localStorage.getItem(key);
const remover = (key: string) => localStorage.removeItem(key);

// 2. Create config (optional, falls back to DEFAULT_CLIENT_CONFIG)
const config = new ChattyClientConfig(false, 'your-server.com');

// 3. Initialize client
const client = new ChattyClient(config ?? DEFAULT_CLIENT_CONFIG)
    .initClient(setter, getter, remover);

// 4. Build sub-APIs
const { auth, users, friends, conversations, messages, blocks, files } =
    ConstructClient(client);
```

### React Native / Expo (async)

```ts
import * as SecureStore from 'expo-secure-store';

const setter = async (key: string, value: string) =>
    await SecureStore.setItemAsync(key, value);
const getter = async (key: string) =>
    await SecureStore.getItemAsync(key);
const remover = async (key: string) =>
    await SecureStore.deleteItemAsync(key);

const config = new ChattyClientConfig(false, 'your-server.com');
const client = await new ChattyClient(config ?? DEFAULT_CLIENT_CONFIG)
    .initClientAsync(setter, getter, remover);

const { auth, users, friends, conversations, messages, blocks, files } =
    ConstructClient(client);
```

## Authentication

```ts
// Login
const res = await auth.login('username', 'password');
const { accessToken, refreshToken, user } = res.data.data;

// Persist tokens (sync mode)
client.setTokens(accessToken, refreshToken, setter);
// Async mode
await client.setTokensAsync(accessToken, refreshToken, setter);

// Logout
client.clearTokens(remover);
// Async mode
await client.clearTokensAsync(remover);

// Auth expired callback (e.g. password changed → forced logout)
client.setOnAuthExpired(() => {
    // Perform logout logic
});
```

> The SDK automatically attaches the `Authorization` header to all requests and refreshes tokens on 401 responses via an axios interceptor.

## Socket.IO

```ts
import { ChattySocket } from 'chatty-sdk';

const socket = new ChattySocket();

// Connect (after login)
socket.connect(
    { accessToken, refreshToken },
    client.config.getSocket()
);

// Events
socket.onMessage((msg) => { /* incoming message */ });
socket.onFriendRequest((req) => { /* friend request received */ });
socket.onUserOnline((userId) => { /* friend came online */ });
socket.onForceDisconnect(() => { /* password changed, forced offline */ });

// Send a message
socket.sendMessage({
    receiver_id: 2,
    type: 'text',
    content: 'Hello!',
});

// Disconnect
socket.disconnect();
```

## API Reference

| Module | Methods |
|--------|---------|
| `auth` | `login`, `register`, `refreshToken`, `changePassword` |
| `users` | `getMyProfile`, `updateProfile`, `getMyPrivacy`, `updatePrivacy`, `searchUsers`, `getUserProfile` |
| `friends` | `sendFriendRequest`, `getFriendRequests`, `handleFriendRequest`, `getFriends`, `deleteFriend`, `generateAddCode`, `verifyAddCode` |
| `conversations` | `getConversations` |
| `messages` | `getMessages` |
| `blocks` | `blockUser`, `getBlocks`, `unblockUser` |
| `files` | `uploadFile`, `getFileUrl`, `getAuthHeaders` |
| `system` | `getHealth`, `getMotd` |

## ChattyClientConfig

```ts
new ChattyClientConfig(useHttps: boolean, endpoint: string)

// Examples
new ChattyClientConfig(false, 'localhost')       // http://localhost:5637
new ChattyClientConfig(true, 'api.example.com')   // https://api.example.com:5637
```

The server API runs on port `5637` by default. *we are not planned to make this changeable yet...*
