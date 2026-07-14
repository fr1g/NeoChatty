*ВКР Х. Чэнь*

-----
notice: yes i do want this project continuable but this repo is only for VKR (which is, the final project in russian university). make a fork to continue this. (whoever wants)
-----

# Chatty (NeoChatty)
Chatty but brand new. Inherited from previous project [ZenChatty](https://github.com/fr1g/zenchatty)
## Overview
This is a self-deployable messenger with SDK provided (TypeScript, [see on NPM](https://www.npmjs.com/package/chatty-sdk)) and Mobile App, Web App built with SDK.

## How to use (as client)

### via Browser
Open it. well what can i say

### via Phone
You can install this app on your Android phone. *Currently the iOS build cannot be provided since we haven't fixed that CI issue.*

### Attention!
You should change the server target to your chatty server before login.

## How to use (to deploy)
### 0) Dependencies
- Node.js 22+
- MySQL 8 / MariaDB 11
- .NET 10 Runtime (for using ChattyStager only)

### 1) All by yourself
- Download the latest `server-dist.zip` from releases and unzip it somewhere
- Download the `init.sql` in the root path of this repo.
- Make sure your DB is running, login into its console, run `source '<path-to-the-sql-file>';`
- After the DB is initialized, CD to your unzipped artifact of your server backend
- run `node dist/index.js` in the directory ⬆️ // well... ¿How to say 上面提到的 in Inglés?

### 2) Chatty Stager (Recommended!)
- download `stager-build.zip` from releases and unzip it somewhere
- goto the directory you unzipped and in console run `dotnet ./ChattyStager.dll`
- We suggest you not using VPN since that may cause the problem that cannot download the artifacts.
- Open this link: [http://localhost:5000/stager](http://localhost:5000/stager) to start your setup. (by default this is via the correct port)
- follow the instructions and deploy your Chatty Server
- We suggest you not changing any configs but "DB passwd", "DB username", "DB port" and MOTDs
- after you complete all these works, goto Settings of stager, click "Run" to run the backend server of chatty.

## How to use the SDK

### Installation

```bash
npm install chatty-sdk
```

### Quick Start

The SDK supports both **synchronous** (browser localStorage) and **asynchronous** (React Native SecureStore) initialization.

#### Browser (sync)

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

#### React Native / Expo (async)

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

### Authentication

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

### Socket.IO

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

### API Reference

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

### ChattyClientConfig

```ts
new ChattyClientConfig(useHttps: boolean, endpoint: string)

// Examples
new ChattyClientConfig(false, 'localhost')       // http://localhost:5637
new ChattyClientConfig(true, 'api.example.com')   // https://api.example.com:5637
```

The server API runs on port `5637` by default. *we are not planned to make this changeable yet...*



## Third-Party Notices

This project includes the following third-party software:

- [TypeScript](https://github.com/microsoft/TypeScript) — Apache-2.0 © Microsoft Corporation
- [munim-bluetooth](https://github.com/munimtechnologies/munim-bluetooth) — Apache-2.0 © Munim Technologies

## Hall of Shame
> Here we will show those who uses our code without our sign remaining.
