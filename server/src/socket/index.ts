import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JwtPayload } from '../middleware/auth';
import { User, Message, Conversation, Contact, Block } from '../models';
import { Op } from 'sequelize';
import sequelize from '../config/database';
let io: Server;
export const onlineUsers = new Map<number, Set<string>>();
export function getIO(): Server {
    return io;
}
function getUserSocketIds(userId: number): string[] {
    return [...(onlineUsers.get(userId) ?? new Set<string>())];
}
export function isUserOnline(userId: number): boolean {
    return getUserSocketIds(userId).length > 0;
}
export function emitToUser(userId: number, event: string, payload: any) {
    for (const socketId of getUserSocketIds(userId)) {
        io.to(socketId).emit(event, payload);
    }
}
function addUserSocket(userId: number, socketId: string) {
    const sockets = onlineUsers.get(userId) ?? new Set<string>();
    const wasOffline = sockets.size === 0;
    sockets.add(socketId);
    onlineUsers.set(userId, sockets);
    return wasOffline;
}
function removeUserSocket(userId: number, socketId: string) {
    const sockets = onlineUsers.get(userId);
    if (!sockets) {
        return false;
    }
    sockets.delete(socketId);
    if (sockets.size === 0) {
        onlineUsers.delete(userId);
        return true;
    }
    return false;
}
export function setupSocket(httpServer: HttpServer) {
    io = new Server(httpServer, {
        path: '/chathub/socket.io',
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) {
                return next(new Error('Missing authentication token'));
            }
            const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
            const user = await User.findByPk(decoded.userId, {
                attributes: ['id', 'token_version'],
            });
            if (!user || user.token_version !== decoded.tokenVersion) {
                return next(new Error('Token has expired'));
            }
            (socket as any).userId = decoded.userId;
            next();
        }
        catch {
            next(new Error('Token is invalid or expired'));
        }
    });
    io.on('connection', (socket: Socket) => {
        const userId = (socket as any).userId as number;
        const shouldNotifyOnline = addUserSocket(userId, socket.id);
        if (shouldNotifyOnline) {
            notifyFriendsStatus(userId, true);
        }
        pushUnreadMessages(socket, userId);
        socket.on('message:send', async (data, callback) => {
            await handleMessageSend(socket, userId, data, callback);
        });
        socket.on('message:recall', async (data, callback) => {
            await handleMessageRecall(socket, userId, data, callback);
        });
        socket.on('message:read', async (data) => {
            await handleMessageRead(userId, data);
        });
        socket.on('disconnect', () => {
            const shouldNotifyOffline = removeUserSocket(userId, socket.id);
            if (shouldNotifyOffline) {
                notifyFriendsStatus(userId, false);
            }
        });
    });
    return io;
}
async function notifyFriendsStatus(userId: number, isOnline: boolean) {
    const contacts = await Contact.findAll({
        where: { user_id: userId },
        attributes: ['friend_id'],
    });
    const event = isOnline ? 'user:online' : 'user:offline';
    for (const f of contacts) {
        if (isUserOnline(f.friend_id)) {
            emitToUser(f.friend_id, event, { userId });
        }
    }
}
async function pushUnreadMessages(socket: Socket, userId: number) {
    try {
        const unreadMessages = await Message.findAll({
            where: {
                receiver_id: userId,
                is_read: false,
            },
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'username', 'display_name', 'avatar_locator'],
                },
            ],
            order: [['id', 'ASC']],
        });
        for (const message of unreadMessages) {
            socket.emit('message:receive', message.toJSON());
        }
    }
    catch (err) {
    }
}
async function handleMessageSend(socket: Socket, senderId: number, data: any, callback?: (response: any) => void) {
    try {
        const { receiver_id, type = 'text', content, file_locator, file_name, file_size, temp_id } = data;
        if (!receiver_id) {
            socket.emit('message:error', { code: 'INVALID_PARAMS', reason: 'Receiver ID is required' });
            return;
        }
        const isFriend = await Contact.findOne({
            where: { user_id: senderId, friend_id: receiver_id },
        });
        if (!isFriend) {
            socket.emit('message:error', { code: 'FORBIDDEN', reason: 'Recipient is not your friend' });
            return;
        }
        const isBlocked = await Block.findOne({
            where: {
                [Op.or]: [
                    { user_id: senderId, blocked_user_id: receiver_id },
                    { user_id: receiver_id, blocked_user_id: senderId },
                ],
            },
        });
        if (isBlocked) {
            socket.emit('message:error', { code: 'FORBIDDEN', reason: 'Failed to send message' });
            return;
        }
        if (type === 'text' && (!content || !content.trim())) {
            socket.emit('message:error', { code: 'INVALID_PARAMS', reason: 'Message content cannot be empty' });
            return;
        }
        if (['image', 'video', 'file'].includes(type) && !file_locator) {
            socket.emit('message:error', { code: 'INVALID_PARAMS', reason: 'File locator is required' });
            return;
        }
        const result = await sequelize.transaction(async (t) => {
            const message = await Message.create({
                sender_id: senderId,
                receiver_id,
                type,
                content: type === 'text' ? content.trim() : null,
                file_locator: type !== 'text' ? file_locator : null,
                file_name: type !== 'text' ? file_name : null,
                file_size: type !== 'text' ? file_size : null,
            }, { transaction: t });
            await Conversation.upsert({
                user_id: senderId,
                peer_id: receiver_id,
                last_message_id: message.id,
                unread_count: 0,
                updated_at: new Date(),
            }, { transaction: t });
            const [receiverConv, created] = await Conversation.findOrCreate({
                where: { user_id: receiver_id, peer_id: senderId },
                defaults: {
                    user_id: receiver_id,
                    peer_id: senderId,
                    last_message_id: message.id,
                    unread_count: 1,
                },
                transaction: t,
            });
            if (!created) {
                await Conversation.update({
                    last_message_id: message.id,
                    unread_count: sequelize.literal('unread_count + 1'),
                    updated_at: new Date(),
                }, {
                    where: { user_id: receiver_id, peer_id: senderId },
                    transaction: t,
                });
            }
            return message;
        });
        const sender = await User.findByPk(senderId, {
            attributes: ['id', 'username', 'display_name', 'avatar_locator'],
        });
        const messageData = {
            id: result.id,
            sender_id: senderId,
            receiver_id,
            type: result.type,
            content: result.content,
            file_locator: result.file_locator,
            file_name: result.file_name,
            file_size: result.file_size,
            is_recalled: false,
            is_read: false,
            created_at: result.created_at,
            sender,
        };
        socket.emit('message:ack', {
            id: result.id,
            created_at: result.created_at,
            temp_id: temp_id ?? undefined,
        });
        if (isUserOnline(receiver_id)) {
            emitToUser(receiver_id, 'message:receive', messageData);
        }
        if (callback) {
            callback({ success: true, id: result.id, created_at: result.created_at });
        }
    }
    catch (err) {
        socket.emit('message:error', { code: 'SERVER_ERROR', reason: 'Failed to send message' });
    }
}
async function handleMessageRecall(socket: Socket, senderId: number, data: any, callback?: (response: any) => void) {
    try {
        const { message_id } = data;
        const message = await Message.findByPk(message_id);
        if (!message) {
            socket.emit('message:error', { code: 'NOT_FOUND', reason: 'Message not found' });
            return;
        }
        if (message.sender_id !== senderId) {
            socket.emit('message:error', { code: 'FORBIDDEN', reason: 'You can only recall your own messages' });
            return;
        }
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        if (message.created_at < twoMinutesAgo) {
            socket.emit('message:error', { code: 'FORBIDDEN', reason: 'Messages can only be recalled within 2 minutes' });
            return;
        }
        if (message.is_recalled) {
            socket.emit('message:error', { code: 'CONFLICT', reason: 'Message has already been recalled' });
            return;
        }
        await message.update({ is_recalled: true });
        socket.emit('message:recalled', { message_id });
        if (isUserOnline(message.receiver_id)) {
            emitToUser(message.receiver_id, 'message:recalled', { message_id });
        }
        if (callback) {
            callback({ success: true });
        }
    }
    catch (err) {
        socket.emit('message:error', { code: 'SERVER_ERROR', reason: 'Failed to recall message' });
    }
}
async function handleMessageRead(userId: number, data: any) {
    try {
        const { peer_id } = data;
        if (!peer_id)
            return;
        await Message.update({ is_read: true }, {
            where: {
                sender_id: peer_id,
                receiver_id: userId,
                is_read: false,
            },
        });
        await Conversation.update({ unread_count: 0 }, { where: { user_id: userId, peer_id } });
        if (isUserOnline(peer_id)) {
            emitToUser(peer_id, 'message:read_ack', { userId });
        }
    }
    catch (err) {
    }
}
export function disconnectUser(userId: number) {
    const socketIds = getUserSocketIds(userId);
    if (socketIds.length > 0) {
        emitToUser(userId, 'force_disconnect', { reason: 'Password changed. Please sign in again' });
        for (const socketId of socketIds) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.disconnect(true);
            }
        }
        onlineUsers.delete(userId);
        notifyFriendsStatus(userId, false);
    }
}
