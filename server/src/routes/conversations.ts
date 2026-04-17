import { Router, Response } from 'express';
import { Conversation, User, Message } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);
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
