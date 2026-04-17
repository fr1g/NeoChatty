import { Router, Response } from 'express';
import { Op } from 'sequelize';
import { User, FriendRequest, Friendship, Block } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import sequelize from '../config/database';
import { emitToUser, isUserOnline } from '../socket';


const router: Router = Router();
router.use(authMiddleware);
router.post('/request', async (req: AuthRequest, res: Response) => {
    try {
        const { to_user_id } = req.body;
        const fromUserId = req.userId!;
        if (!to_user_id) {
            return error(res, 'INVALID_PARAMS', 'Target user ID is required', 400);
        }
        if (to_user_id === fromUserId) {
            return error(res, 'INVALID_PARAMS', 'You cannot add yourself as a friend', 400);
        }
        const targetUser = await User.findByPk(to_user_id);
        if (!targetUser) {
            return error(res, 'NOT_FOUND', 'Target user not found', 404);
        }
        const blocked = await Block.findOne({
            where: {
                [Op.or]: [
                    { user_id: fromUserId, blocked_user_id: to_user_id },
                    { user_id: to_user_id, blocked_user_id: fromUserId },
                ],
            },
        });
        if (blocked) {
            return error(res, 'FORBIDDEN', 'Unable to send friend request', 403);
        }
        const existingFriendship = await Friendship.findOne({
            where: { user_id: fromUserId, friend_id: to_user_id },
        });
        if (existingFriendship) {
            return error(res, 'CONFLICT', 'You are already friends', 409);
        }
        const existingRequest = await FriendRequest.findOne({
            where: { from_user_id: fromUserId, to_user_id, status: 'pending' },
        });
        if (existingRequest) {
            return error(res, 'CONFLICT', 'A pending friend request already exists', 409);
        }
        const reverseRequest = await FriendRequest.findOne({
            where: { from_user_id: to_user_id, to_user_id: fromUserId, status: 'pending' },
        });
        if (reverseRequest) {
            await sequelize.transaction(async (t) => {
                await reverseRequest.update({ status: 'accepted' }, { transaction: t });
                await FriendRequest.create({ from_user_id: fromUserId, to_user_id, status: 'accepted' }, { transaction: t });
                await Friendship.bulkCreate([
                    { user_id: fromUserId, friend_id: to_user_id },
                    { user_id: to_user_id, friend_id: fromUserId },
                ], { transaction: t });
            });
            if (isUserOnline(fromUserId)) {
                emitToUser(fromUserId, 'friend:accepted', { userId: to_user_id });
            }
            if (isUserOnline(to_user_id)) {
                emitToUser(to_user_id, 'friend:accepted', { userId: fromUserId });
            }
            return success(res, { message: 'Mutual requests detected. You are now friends automatically', auto_accepted: true }, 201);
        }
        const request = await FriendRequest.create({
            from_user_id: fromUserId,
            to_user_id,
        });
        if (isUserOnline(to_user_id)) {
            const fromUser = await User.findByPk(fromUserId, {
                attributes: ['id', 'username', 'display_name', 'avatar_locator'],
            });
            emitToUser(to_user_id, 'friend:request', {
                id: request.id,
                fromUser,
            });
        }
        return success(res, { id: request.id, message: 'Friend request sent' }, 201);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
router.get('/requests', async (req: AuthRequest, res: Response) => {
    try {
        const type = req.query.type as string;
        const userId = req.userId!;
        if (!type || !['received', 'sent'].includes(type)) {
            return error(res, 'INVALID_PARAMS', 'type must be received or sent', 400);
        }
        let where: any;
        let includeAlias: string;
        if (type === 'sent') {
            where = { from_user_id: userId, status: 'pending' };
            includeAlias = 'toUser';
        }
        else {
            where = { to_user_id: userId, status: 'pending' };
            includeAlias = 'fromUser';
        }
        const requests = await FriendRequest.findAll({
            where,
            include: [
                {
                    model: User,
                    as: includeAlias,
                    attributes: ['id', 'username', 'display_name', 'avatar_locator'],
                },
            ],
            order: [['created_at', 'DESC']],
        });
        return success(res, requests);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
router.put('/request/:id', async (req: AuthRequest, res: Response) => {
    try {
        const requestId = parseInt(req.params.id);
        const { status } = req.body;
        if (!['accepted', 'rejected'].includes(status)) {
            return error(res, 'INVALID_PARAMS', 'status must be accepted or rejected', 400);
        }
        const request = await FriendRequest.findByPk(requestId);
        if (!request) {
            return error(res, 'NOT_FOUND', 'Friend request not found', 404);
        }
        if (request.to_user_id !== req.userId!) {
            return error(res, 'FORBIDDEN', 'You can only handle requests sent to you', 403);
        }
        if (request.status !== 'pending') {
            return error(res, 'CONFLICT', 'This request has already been handled', 409);
        }
        if (status === 'accepted') {
            await sequelize.transaction(async (t) => {
                await request.update({ status: 'accepted' }, { transaction: t });
                await Friendship.bulkCreate([
                    { user_id: request.from_user_id, friend_id: request.to_user_id },
                    { user_id: request.to_user_id, friend_id: request.from_user_id },
                ], { transaction: t, ignoreDuplicates: true });
            });
            if (isUserOnline(request.from_user_id)) {
                emitToUser(request.from_user_id, 'friend:accepted', { userId: req.userId! });
            }
        }
        else {
            await request.update({ status: 'rejected' });
        }
        return success(res, { message: status === 'accepted' ? 'Friend request accepted' : 'Friend request rejected' });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const friendships = await Friendship.findAll({
            where: { user_id: req.userId! },
            include: [
                {
                    model: User,
                    as: 'friend',
                    attributes: ['id', 'username', 'display_name', 'avatar_locator'],
                },
            ],
        });
        const friends = friendships.map((f) => {
            const friend = (f as any).friend;
            return {
                ...friend.toJSON(),
                is_online: isUserOnline(friend.id),
            };
        });
        return success(res, friends);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
router.delete('/:userId', async (req: AuthRequest, res: Response) => {
    try {
        const friendUserId = parseInt(req.params.userId);
        const userId = req.userId!;
        if (isNaN(friendUserId)) {
            return error(res, 'INVALID_PARAMS', 'Invalid user ID', 400);
        }
        const deleted = await Friendship.destroy({
            where: {
                [Op.or]: [
                    { user_id: userId, friend_id: friendUserId },
                    { user_id: friendUserId, friend_id: userId },
                ],
            },
        });
        if (deleted === 0) {
            return error(res, 'NOT_FOUND', 'Friendship not found', 404);
        }
        return success(res, { message: 'Friend removed' });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
export default router;
