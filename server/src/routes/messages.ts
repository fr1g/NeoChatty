import { Router, Response } from 'express';
import { Op } from 'sequelize';
import { Message, User, Contact, Conversation } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';


const router: Router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /messages/{friendId}:
 *   get:
 *     summary: Get messages with a friend
 *     description: Retrieves message history with a specific friend with pagination support
 *     tags:
 *       - Messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: friendId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: before
 *         in: query
 *         schema:
 *           type: integer
 *         description: Message ID to start loading messages before (for pagination)
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 50
 *         description: Number of messages to retrieve
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       sender_id:
 *                         type: integer
 *                       receiver_id:
 *                         type: integer
 *                       type:
 *                         type: string
 *                       content:
 *                         type: string
 *                       file_name:
 *                         type: string
 *                       is_recalled:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       sender:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           username:
 *                             type: string
 *                           display_name:
 *                             type: string
 *                           avatar_locator:
 *                             type: string
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: No access to this conversation
 *       500:
 *         description: Internal server error
 */
router.get('/:friendId', async (req: AuthRequest, res: Response) => {
    try {
        const friendId = parseInt(req.params.friendId);
        const userId = req.userId!;
        const before = req.query.before ? parseInt(req.query.before as string) : undefined;
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 30));
        if (isNaN(friendId)) {
            return error(res, 'INVALID_PARAMS', 'Invalid friend ID', 400);
        }
        const isFriend = await Contact.findOne({
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
