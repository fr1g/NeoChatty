import { io, Socket } from 'socket.io-client';

export let socket: Socket | null = null;
let reconnectCallback: (() => void) | null = null;
let isFirstConnect = true;
export function setOnReconnect(cb: () => void) {
    reconnectCallback = cb;
}
export function connect(tokens: { accessToken: string | null, refreshToken: string | null }, url: string): Socket {
    const token = tokens?.accessToken ?? '';
    console.log(token, tokens, url, 0);
    if (socket) {
        socket.disconnect();
    }
    isFirstConnect = true;
    socket = io(url, {
        auth: { token },
        path: '/chathub/socket.io',
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        reconnectionAttempts: Infinity,
    });
    socket.on('connect', () => {
        if (!isFirstConnect && reconnectCallback) {
            reconnectCallback();
        }
        isFirstConnect = false;
    });
    socket.connect();
    return socket;
}
export function disconnect(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
export function getSocket(): Socket | null {
    return socket;
}
function on<T = any>(event: string, callback: (data: T) => void): () => void {
    socket?.on(event, callback);
    return () => {
        socket?.off(event, callback);
    };
}
export function sendMessage(data: any): void {
    console.log(`msg out ${JSON.stringify(data)}`, socket)
    socket?.emit('message:send', data);
}
export function recallMessage(message_id: number): void {
    socket?.emit('message:recall', { message_id });
}
export function markAsRead(peer_id: number): void {
    socket?.emit('message:read', { peer_id });
}
export function onMessage(callback: (data: any) => void) {
    return on('message:receive', callback);
}
export function onMessageRecalled(callback: (data: any) => void) {
    return on('message:recalled', callback);
}
export function onMessageAck(callback: (data: any) => void) {
    return on('message:ack', callback);
}
export function onMessageReadAck(callback: (data: any) => void) {
    return on('message:read_ack', callback);
}
export function onMessageError(callback: (data: any) => void) {
    return on('message:error', callback);
}
export function onFriendRequest(callback: (data: any) => void) {
    return on('friend:request', callback);
}
export function onFriendAccepted(callback: (data: any) => void) {
    return on('friend:accepted', callback);
}
export function onUserOnline(callback: (data: any) => void) {
    return on('user:online', callback);
}
export function onUserOffline(callback: (data: any) => void) {
    return on('user:offline', callback);
}
export function onForceDisconnect(callback: (data: any) => void) {
    return on('force_disconnect', callback);
}
export function removeAllListeners(): void {
    socket?.removeAllListeners();
}
