import { Router, Response } from 'express';
import { Op } from 'sequelize';
import { User, PrivacySetting, Contact, Block, FriendRequest } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';


const router: Router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieves the authenticated user's profile information including privacy settings
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     display_name:
 *                       type: string
 *                     avatar_locator:
 *                       type: string
 *                     background_locator:
 *                       type: string
 *                     privacy:
 *                       type: object
 *                       properties:
 *                         searchable_by_username:
 *                           type: boolean
 *                         searchable_by_display_name:
 *                           type: boolean
 *                         show_avatar_to_strangers:
 *                           type: boolean
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findByPk(req.userId!, {
            attributes: ['id', 'username', 'display_name', 'avatar_locator', 'background_locator'],
            include: [
                {
                    model: PrivacySetting,
                    as: 'privacy',
                    attributes: ['searchable_by_username', 'searchable_by_display_name', 'show_avatar_to_strangers'],
                },
            ],
        });
        if (!user) {
            return error(res, 'NOT_FOUND', 'User not found', 404);
        }
        return success(res, user);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Update current user profile
 *     description: Updates display name, avatar, and background locator for the authenticated user
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *                 description: Display name (1-50 characters)
 *               avatar_locator:
 *                 type: string
 *               background_locator:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     display_name:
 *                       type: string
 *                     avatar_locator:
 *                       type: string
 *                     background_locator:
 *                       type: string
 *       400:
 *         description: Invalid input parameters
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/me', async (req: AuthRequest, res: Response) => {
    try {
        const { display_name, avatar_locator, background_locator } = req.body;
        const user = await User.findByPk(req.userId!);
        if (!user) {
            return error(res, 'NOT_FOUND', 'User not found', 404);
        }
        if (display_name !== undefined) {
            const trimmed = String(display_name).trim();
            if (trimmed.length < 1 || trimmed.length > 50) {
                return error(res, 'INVALID_PARAMS', 'Display name must be between 1 and 50 characters', 400);
            }
            user.display_name = trimmed;
        }
        if (avatar_locator !== undefined) {
            user.avatar_locator = avatar_locator;
        }
        if (background_locator !== undefined) {
            user.background_locator = background_locator;
        }
        await user.save();
        return success(res, {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_locator: user.avatar_locator,
            background_locator: user.background_locator,
        });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /users/me/privacy:
 *   get:
 *     summary: Get user privacy settings
 *     description: Retrieves the privacy settings for the authenticated user
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Privacy settings retrieved successfully
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
 *                     searchable_by_username:
 *                       type: boolean
 *                     searchable_by_display_name:
 *                       type: boolean
 *                     show_avatar_to_strangers:
 *                       type: boolean
 *       404:
 *         description: Privacy settings not found
 *       500:
 *         description: Internal server error
 */
router.get('/me/privacy', async (req: AuthRequest, res: Response) => {
    try {
        const privacy = await PrivacySetting.findByPk(req.userId!);
        if (!privacy) {
            return error(res, 'NOT_FOUND', 'Privacy settings not found', 404);
        }
        return success(res, {
            searchable_by_username: privacy.searchable_by_username,
            searchable_by_display_name: privacy.searchable_by_display_name,
            show_avatar_to_strangers: privacy.show_avatar_to_strangers,
        });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /users/me/privacy:
 *   put:
 *     summary: Update user privacy settings
 *     description: Updates privacy settings for the authenticated user
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               searchable_by_username:
 *                 type: boolean
 *               searchable_by_display_name:
 *                 type: boolean
 *               show_avatar_to_strangers:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Privacy settings updated successfully
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
 *                     searchable_by_username:
 *                       type: boolean
 *                     searchable_by_display_name:
 *                       type: boolean
 *                     show_avatar_to_strangers:
 *                       type: boolean
 *       404:
 *         description: Privacy settings not found
 *       500:
 *         description: Internal server error
 */
router.put('/me/privacy', async (req: AuthRequest, res: Response) => {
    try {
        const { searchable_by_username, searchable_by_display_name, show_avatar_to_strangers } = req.body;
        const privacy = await PrivacySetting.findByPk(req.userId!);
        if (!privacy) {
            return error(res, 'NOT_FOUND', 'Privacy settings not found', 404);
        }
        if (typeof searchable_by_username === 'boolean') {
            privacy.searchable_by_username = searchable_by_username;
        }
        if (typeof searchable_by_display_name === 'boolean') {
            privacy.searchable_by_display_name = searchable_by_display_name;
        }
        if (typeof show_avatar_to_strangers === 'boolean') {
            privacy.show_avatar_to_strangers = show_avatar_to_strangers;
        }
        await privacy.save();
        return success(res, {
            searchable_by_username: privacy.searchable_by_username,
            searchable_by_display_name: privacy.searchable_by_display_name,
            show_avatar_to_strangers: privacy.show_avatar_to_strangers,
        });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /users/search:
 *   get:
 *     summary: Search for users
 *     description: Searches for users by username or display name. Respects privacy settings and blocks.
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Search results
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
 *                     users:
 *                       type: array
 *                       items:
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
 *                             nullable: true
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       500:
 *         description: Internal server error
 */
router.get('/search', async (req: AuthRequest, res: Response) => {
    try {
        const q = String(req.query.q || '').trim();
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const offset = (page - 1) * limit;
        if (!q) {
            return success(res, { users: [], total: 0, page, limit });
        }
        const blockedByOthers = await Block.findAll({
            where: { blocked_user_id: req.userId! },
            attributes: ['user_id'],
        });
        const blockedByOthersIds = blockedByOthers.map((b) => b.user_id);
        const blockedByMe = await Block.findAll({
            where: { user_id: req.userId! },
            attributes: ['blocked_user_id'],
        });
        const blockedByMeIds = blockedByMe.map((b) => b.blocked_user_id);
        const excludeIds = [...new Set([req.userId!, ...blockedByOthersIds, ...blockedByMeIds])];
        const searchPattern = `%${q}%`;
        const { count, rows } = await User.findAndCountAll({
            where: {
                id: { [Op.notIn]: excludeIds },
                [Op.or]: [
                    {
                        username: { [Op.like]: searchPattern },
                        '$privacy.searchable_by_username$': true,
                    },
                    {
                        display_name: { [Op.like]: searchPattern },
                        '$privacy.searchable_by_display_name$': true,
                    },
                ],
            },
            attributes: ['id', 'username', 'display_name', 'avatar_locator'],
            include: [
                {
                    model: PrivacySetting,
                    as: 'privacy',
                    attributes: ['show_avatar_to_strangers'],
                },
            ],
            limit,
            offset,
            subQuery: false,
        });
        const users = rows.map((u) => {
            const obj: any = {
                id: u.id,
                username: u.username,
                display_name: u.display_name,
            };
            const priv = (u as any).privacy;
            if (!priv || priv.show_avatar_to_strangers) {
                obj.avatar_locator = u.avatar_locator;
            }
            else {
                obj.avatar_locator = null;
            }
            return obj;
        });
        return success(res, { users, total: count, page, limit });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user profile by ID
 *     description: Retrieves another user's profile with relationship status. Cannot use for own profile.
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User profile retrieved
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
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     display_name:
 *                       type: string
 *                     avatar_locator:
 *                       type: string
 *                       nullable: true
 *                     background_locator:
 *                       type: string
 *                     relationship:
 *                       type: string
 *                       enum: [friend, pending_sent, pending_received, stranger, blocked]
 *                     friend_request_id:
 *                       type: integer
 *                       nullable: true
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Access forbidden (blocked or you are blocked)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const targetId = parseInt(req.params.id);
        if (isNaN(targetId)) {
            return error(res, 'INVALID_PARAMS', 'Invalid user ID', 400);
        }
        if (targetId === req.userId!) {
            return error(res, 'INVALID_PARAMS', 'Use /me to view your own profile', 400);
        }
        const targetUser = await User.findByPk(targetId, {
            attributes: ['id', 'username', 'display_name', 'avatar_locator', 'background_locator'],
            include: [
                {
                    model: PrivacySetting,
                    as: 'privacy',
                    attributes: ['show_avatar_to_strangers'],
                },
            ],
        });
        if (!targetUser) {
            return error(res, 'NOT_FOUND', 'User not found', 404);
        }
        const blocked = await Block.findOne({
            where: { user_id: targetId, blocked_user_id: req.userId! },
        });
        if (blocked) {
            return error(res, 'FORBIDDEN', 'You do not have access to this profile', 403);
        }
        let relationship: 'friend' | 'pending_sent' | 'pending_received' | 'stranger' | 'blocked' = 'stranger';
        let friendRequestId: number | null = null;
        const myBlock = await Block.findOne({
            where: { user_id: req.userId!, blocked_user_id: targetId },
        });
        if (myBlock) {
            relationship = 'blocked';
        }
        else {
            const contact = await Contact.findOne({
                where: { user_id: req.userId!, friend_id: targetId },
            });
            if (contact) {
                relationship = 'friend';
            }
            else {
                const sentRequest = await FriendRequest.findOne({
                    where: { from_user_id: req.userId!, to_user_id: targetId, status: 'pending' },
                });
                if (sentRequest) {
                    relationship = 'pending_sent';
                }
                else {
                    const receivedRequest = await FriendRequest.findOne({
                        where: { from_user_id: targetId, to_user_id: req.userId!, status: 'pending' },
                    });
                    if (receivedRequest) {
                        relationship = 'pending_received';
                        friendRequestId = receivedRequest.id;
                    }
                }
            }
        }
        const isFriend = relationship === 'friend';
        const privacy = (targetUser as any).privacy;
        const showAvatar = isFriend || !privacy || privacy.show_avatar_to_strangers;
        const profile: any = {
            id: targetUser.id,
            username: targetUser.username,
            display_name: targetUser.display_name,
            background_locator: targetUser.background_locator,
            relationship,
        };
        if (friendRequestId !== null) {
            profile.friend_request_id = friendRequestId;
        }
        if (showAvatar) {
            profile.avatar_locator = targetUser.avatar_locator;
        }
        return success(res, profile);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
export default router;
