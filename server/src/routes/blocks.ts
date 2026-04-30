import { Router, Response } from 'express';
import { Op } from 'sequelize';
import { User, Block, Contact, FriendRequest } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import sequelize from '../config/database';



const router: Router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /blocks:
 *   post:
 *     summary: Block a user
 *     description: Blocks a user and removes them from contacts and pending friend requests
 *     tags:
 *       - Blocks
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: User blocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Target user not found
 *       409:
 *         description: User is already blocked
 *       500:
 *         description: Internal server error
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { user_id: blockedUserId } = req.body;
        const userId = req.userId!;
        if (!blockedUserId) {
            return error(res, 'INVALID_PARAMS', 'Target user ID is required', 400);
        }
        if (blockedUserId === userId) {
            return error(res, 'INVALID_PARAMS', 'You cannot block yourself', 400);
        }
        const targetUser = await User.findByPk(blockedUserId);
        if (!targetUser) {
            return error(res, 'NOT_FOUND', 'Target user not found', 404);
        }
        const existing = await Block.findOne({
            where: { user_id: userId, blocked_user_id: blockedUserId },
        });
        if (existing) {
            return error(res, 'CONFLICT', 'User is already blocked', 409);
        }
        await sequelize.transaction(async (t) => {
            await Block.create({ user_id: userId, blocked_user_id: blockedUserId }, { transaction: t });
            await Contact.destroy({
                where: {
                    [Op.or]: [
                        { user_id: userId, friend_id: blockedUserId },
                        { user_id: blockedUserId, friend_id: userId },
                    ],
                },
                transaction: t,
            });
            await FriendRequest.destroy({
                where: {
                    status: 'pending',
                    [Op.or]: [
                        { from_user_id: userId, to_user_id: blockedUserId },
                        { from_user_id: blockedUserId, to_user_id: userId },
                    ],
                },
                transaction: t,
            });
        });
        return success(res, { message: 'User blocked' }, 201);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /blocks:
 *   get:
 *     summary: Get blocked users list
 *     description: Retrieves all users blocked by the authenticated user
 *     tags:
 *       - Blocks
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Blocked users retrieved successfully
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
 *                       blocked_user_id:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       blockedUser:
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
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const blocks = await Block.findAll({
            where: { user_id: req.userId! },
            include: [
                {
                    model: User,
                    as: 'blockedUser',
                    attributes: ['id', 'username', 'display_name', 'avatar_locator'],
                },
            ],
            order: [['created_at', 'DESC']],
        });
        return success(res, blocks);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /blocks/{userId}:
 *   delete:
 *     summary: Unblock a user
 *     description: Removes a user from the blocked list
 *     tags:
 *       - Blocks
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User is not in blocklist
 *       500:
 *         description: Internal server error
 */
router.delete('/:userId', async (req: AuthRequest, res: Response) => {
    try {
        const blockedUserId = parseInt(req.params.userId);
        const userId = req.userId!;
        if (isNaN(blockedUserId)) {
            return error(res, 'INVALID_PARAMS', 'Invalid user ID', 400);
        }
        const deleted = await Block.destroy({
            where: { user_id: userId, blocked_user_id: blockedUserId },
        });
        if (deleted === 0) {
            return error(res, 'NOT_FOUND', 'User is not in your blocklist', 404);
        }
        return success(res, { message: 'User unblocked' });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
export default router;
