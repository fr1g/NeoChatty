const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { io } = require('../../app/node_modules/socket.io-client');
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8089';
const API_BASE_URL = `${BASE_URL}/api`;
const USERNAME_PREFIX = `s${Date.now().toString(36).slice(-6)}`;

import appConfig from '../../src/server/src/appconfig';

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
async function request(method, pathname, { token, body, headers } = {}) {
    const response = await fetch(`${API_BASE_URL}${pathname}`, {
        method,
        headers: {
            ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(headers || {}),
        },
        body: body === undefined
            ? undefined
            : body instanceof FormData
                ? body
                : JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text();
    return { response, data };
}
function createSocket(token) {
    return io(BASE_URL, {
        transports: ['websocket'],
        auth: { token },
        reconnection: false,
        timeout: 5000,
    });
}
function waitForEvent(socket, event, matcher, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`等待事件超时: ${event}`));
        }, timeoutMs);
        const handler = (payload) => {
            if (matcher && !matcher(payload)) {
                return;
            }
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(payload);
        };
        socket.on(event, handler);
    });
}
function connectSocket(socket) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Socket timeout'));
        }, 5000);
        socket.once('connect', () => {
            clearTimeout(timer);
            resolve();
        });
        socket.once('connect_error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
async function cleanupUsers(usernames) {
    const connection = await mysql.createConnection({
        host: appConfig.DB.HOST ?? 'localhost',
        port: appConfig.DB.PORT ?? 3306,
        user: appConfig.DB.USER ?? 'root',
        password: appConfig.DB.PASSWORD ?? '7355608',
        database: appConfig.DB.NAME ?? 'chatty',
    });
    try {
        const [users] = await connection.query(`SELECT id FROM users WHERE username IN (${usernames.map(() => '?').join(',')})`, usernames);
        const userIds = users.map((user) => user.id);
        if (userIds.length === 0) {
            return;
        }
        const [files] = await connection.query(`SELECT storage_path FROM files WHERE uploader_id IN (${userIds.map(() => '?').join(',')})`, userIds);
        for (const file of files) {
            if (file.storage_path && fs.existsSync(file.storage_path)) {
                fs.unlinkSync(file.storage_path);
            }
        }
        const deleteByUserIds = async (sqlPrefix) => {
            await connection.query(`${sqlPrefix} IN (${userIds.map(() => '?').join(',')})`, userIds);
        };
        await connection.query(`DELETE FROM messages WHERE sender_id IN (${userIds.map(() => '?').join(',')}) OR receiver_id IN (${userIds.map(() => '?').join(',')})`, [...userIds, ...userIds]);
        await connection.query(`DELETE FROM conversations WHERE user_id IN (${userIds.map(() => '?').join(',')}) OR peer_id IN (${userIds.map(() => '?').join(',')})`, [...userIds, ...userIds]);
        await connection.query(`DELETE FROM friend_requests WHERE from_user_id IN (${userIds.map(() => '?').join(',')}) OR to_user_id IN (${userIds.map(() => '?').join(',')})`, [...userIds, ...userIds]);
        await connection.query(`DELETE FROM contacts WHERE user_id IN (${userIds.map(() => '?').join(',')}) OR friend_id IN (${userIds.map(() => '?').join(',')})`, [...userIds, ...userIds]);
        await connection.query(`DELETE FROM blocks WHERE user_id IN (${userIds.map(() => '?').join(',')}) OR blocked_user_id IN (${userIds.map(() => '?').join(',')})`, [...userIds, ...userIds]);
        await deleteByUserIds('DELETE FROM files WHERE uploader_id');
        await deleteByUserIds('DELETE FROM privacy_settings WHERE user_id');
        await deleteByUserIds('DELETE FROM users WHERE id');
    }
    finally {
        await connection.end();
    }
}
async function run() {
    const usernames = [
        `${USERNAME_PREFIX}_alice`,
        `${USERNAME_PREFIX}_bob`,
    ];
    let socketA1;
    let socketA2;
    let socketB;
    try {
        const health = await request('GET', '/health');
        assert(health.response.ok, 'healthcheck failed');
        const registerAlice = await request('POST', '/auth/register', {
            body: {
                username: usernames[0],
                password: 'secret123',
                display_name: 'Alice Smoke',
            },
        });
        const registerBob = await request('POST', '/auth/register', {
            body: {
                username: usernames[1],
                password: 'secret123',
                display_name: 'Bob Smoke',
            },
        });
        assert(registerAlice.response.status === 201, 'Alice 注册失败');
        assert(registerBob.response.status === 201, 'Bob 注册失败');
        const alice = registerAlice.data.data;
        const bob = registerBob.data.data;
        const search = await request('GET', `/users/search?q=${encodeURIComponent(usernames[1])}`, {
            token: alice.accessToken,
        });
        assert(search.response.ok, '搜索接口失败');
        assert((search.data.data.users || []).some((user) => user.id === bob.user.id), '搜索结果未返回 Bob');
        const sendRequest = await request('POST', '/friends/request', {
            token: alice.accessToken,
            body: { to_user_id: bob.user.id },
        });
        assert(sendRequest.response.status === 201, '发送好友请求失败');
        const receivedRequests = await request('GET', '/friends/requests?type=received', {
            token: bob.accessToken,
        });
        assert(receivedRequests.response.ok, '拉取收到的好友请求失败');
        const pendingRequest = (receivedRequests.data.data || [])[0];
        assert(pendingRequest?.from_user_id === alice.user.id, '收到的好友请求不正确');
        const acceptRequest = await request('PUT', `/friends/request/${pendingRequest.id}`, {
            token: bob.accessToken,
            body: { status: 'accepted' },
        });
        assert(acceptRequest.response.ok, '通过好友请求失败');
        const aliceFriends = await request('GET', '/friends', { token: alice.accessToken });
        const bobFriends = await request('GET', '/friends', { token: bob.accessToken });
        assert((aliceFriends.data.data || []).some((user) => user.id === bob.user.id), 'Alice 好友列表缺少 Bob');
        assert((bobFriends.data.data || []).some((user) => user.id === alice.user.id), 'Bob 好友列表缺少 Alice');
        socketA1 = createSocket(alice.accessToken);
        socketA2 = createSocket(alice.accessToken);
        await connectSocket(socketA1);
        await connectSocket(socketA2);
        const ackPromise = waitForEvent(socketA1, 'message:ack', (payload) => payload.temp_id === 'offline-1');
        socketA1.emit('message:send', {
            receiver_id: bob.user.id,
            type: 'text',
            content: 'offline hello',
            temp_id: 'offline-1',
        });
        const ack = await ackPromise;
        assert(ack.id, '消息 ACK 缺少消息 ID');
        socketB = createSocket(bob.accessToken);
        const offlineReceive = waitForEvent(socketB, 'message:receive', (payload) => payload.id === ack.id && payload.content === 'offline hello', 8000);
        await connectSocket(socketB);
        await offlineReceive;
        const readAck = waitForEvent(socketA1, 'message:read_ack', (payload) => payload.userId === bob.user.id);
        socketB.emit('message:read', { peer_id: alice.user.id });
        await readAck;
        const recalled = waitForEvent(socketB, 'message:recalled', (payload) => payload.message_id === ack.id);
        socketA1.emit('message:recall', { message_id: ack.id });
        await recalled;
        const forceDisconnect1 = waitForEvent(socketA1, 'force_disconnect', null, 8000);
        const forceDisconnect2 = waitForEvent(socketA2, 'force_disconnect', null, 8000);
        const passwordChange = await request('PUT', '/auth/password', {
            token: alice.accessToken,
            body: { old_password: 'secret123', new_password: 'secret456' },
        });
        assert(passwordChange.response.ok, '修改密码失败');
        await Promise.all([forceDisconnect1, forceDisconnect2]);
        const oldTokenProfile = await request('GET', '/users/me', { token: alice.accessToken });
        assert(oldTokenProfile.response.status === 401, '旧 token 未失效');
        const reloginAlice = await request('POST', '/auth/login', {
            body: { username: usernames[0], password: 'secret456' },
        });
        assert(reloginAlice.response.ok, '新密码登录失败');
        const blockAlice = await request('POST', '/blocks', {
            token: bob.accessToken,
            body: { user_id: alice.user.id },
        });
        assert(blockAlice.response.status === 201, '拉黑失败');
        const bobFriendsAfterBlock = await request('GET', '/friends', { token: bob.accessToken });
        assert(!(bobFriendsAfterBlock.data.data || []).some((user) => user.id === alice.user.id), '拉黑后好友关系未解除');
        const blockedSearch = await request('GET', `/users/search?q=${encodeURIComponent(usernames[1])}`, { token: reloginAlice.data.data.accessToken });
        assert(!(blockedSearch.data.data.users || []).some((user) => user.id === bob.user.id), '拉黑后搜索结果仍暴露被拉黑用户');
        const blockedRequest = await request('POST', '/friends/request', {
            token: reloginAlice.data.data.accessToken,
            body: { to_user_id: bob.user.id },
        });
        assert(blockedRequest.response.status === 403, '拉黑后仍可发送好友请求');
        const unblockAlice = await request('DELETE', `/blocks/${alice.user.id}`, {
            token: bob.accessToken,
        });
        assert(unblockAlice.response.ok, '解除拉黑失败');
        const searchAfterUnblock = await request('GET', `/users/search?q=${encodeURIComponent(usernames[1])}`, { token: reloginAlice.data.data.accessToken });
        assert((searchAfterUnblock.data.data.users || []).some((user) => user.id === bob.user.id), '解除拉黑后搜索结果未恢复');
        const uploadData = new FormData();
        uploadData.append('file', new Blob(['smoke file upload'], { type: 'text/plain' }), 'smoke.txt');
        const upload = await request('POST', '/files/upload', {
            token: reloginAlice.data.data.accessToken,
            body: uploadData,
        });
        assert(upload.response.status === 201, '文件上传失败');
        const heicUploadData = new FormData();
        heicUploadData.append('file', new Blob(['smoke heic upload'], { type: 'image/heic' }), 'smoke.heic');
        const heicUpload = await request('POST', '/files/upload', {
            token: reloginAlice.data.data.accessToken,
            body: heicUploadData,
        });
        assert(heicUpload.response.status === 201, 'HEIC 图片上传失败');
        const locator = upload.data.data.locator;
        const unauthenticatedDownload = await fetch(`${API_BASE_URL}/files/${locator}`);
        assert(unauthenticatedDownload.status === 401, '未认证下载未被拦截');
        const authenticatedDownload = await request('GET', `/files/${locator}`, {
            token: reloginAlice.data.data.accessToken,
        });
        assert(authenticatedDownload.response.ok, '认证下载失败');
        assert(authenticatedDownload.data === 'smoke file upload', '下载文件内容不匹配');
    }
    finally {
        [socketA1, socketA2, socketB].forEach((socket) => {
            if (socket) {
                socket.disconnect();
            }
        });
        await cleanupUsers(usernames);
    }
}
run().catch((err) => {
    process.exit(1);
});
