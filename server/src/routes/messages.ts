import { Router, Response } from 'express';
import { Op } from 'sequelize';
import { Message, User, Friendship, Conversation } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';


const router: Router = Router();
router.use(authMiddleware);
router.get('/:friendId', async (req: AuthRequest, res: Response) => {
    try {
        const friendId = parseInt(req.params.friendId);
        const userId = req.userId!;
        const before = req.query.before ? parseInt(req.query.before as string) : undefined;
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 30));
        if (isNaN(friendId)) {
            return error(res, 'INVALID_PARAMS', 'Invalid friend ID', 400);
        }
        const isFriend = await Friendship.findOne({
            where: { user_id: userId, friend_id: friendId },
        });
        const hasConversation = !isFriend && await Conversation.findOne({
            where: { user_id: userId, peer_id: friendId },
        });
        if (!isFriend && !hasConversation) {
            return error(res, 'FORBIDDEN', 'You do not have access to this conversation', 403);
        }
        const where: any = {
            [Op.or]: [
                { sender_id: userId, receiver_id: friendId },
                { sender_id: friendId, receiver_id: userId },
            ],
        };
        if (before) {
            where.id = { [Op.lt]: before };
        }
        const messages = await Message.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'username', 'display_name', 'avatar_locator'],
                },
            ],
            order: [['id', 'DESC']],
            limit,
        });
        return success(res, messages.reverse());
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
export default router;
