import { Router, Response } from 'express';
import { Conversation, User, Message } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /conversations:
 *   get:
 *     summary: Get all conversations
 *     description: Retrieves all conversations for the authenticated user with the latest message and peer details
 *     tags:
 *       - Conversations
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
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
 *                       user_id:
 *                         type: integer
 *                       peer_id:
 *                         type: integer
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       peer:
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
 *                       lastMessage:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           sender_id:
 *                             type: integer
 *                           type:
 *                             type: string
 *                           content:
 *                             type: string
 *                           file_name:
 *                             type: string
 *                           is_recalled:
 *                             type: boolean
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const conversations = await Conversation.findAll({
            where: { user_id: req.userId! },
            include: [
                {
                    model: User,
                    as: 'peer',
                    attributes: ['id', 'username', 'display_name', 'avatar_locator'],
                },
                {
                    model: Message,
                    as: 'lastMessage',
                    attributes: ['id', 'sender_id', 'type', 'content', 'file_name', 'is_recalled', 'created_at'],
                },
            ],
            order: [['updated_at', 'DESC']],
        });
        return success(res, conversations);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
export default router;
