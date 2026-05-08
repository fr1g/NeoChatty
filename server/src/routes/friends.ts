import express, { Router, Response } from 'express';
import { Op } from 'sequelize';
import { User, FriendRequest, Contact, Block } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import sequelize from '../config/database';
import { emitToUser, isUserOnline } from '../socket';
import AddCode from '../utils/AddCode';


const router: Router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /friends/request:
 *   post:
 *     summary: Send a friend request
 *     description: Sends a friend request to another user. Detects mutual requests and auto-accepts.
 *     tags:
 *       - Friends
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to_user_id
 *             properties:
 *               to_user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Friend request sent successfully
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
 *                     message:
 *                       type: string
 *                     auto_accepted:
 *                       type: boolean
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Unable to send request (blocked or blocks you)
 *       404:
 *         description: Target user not found
 *       409:
 *         description: Already friends or request already exists
 *       500:
 *         description: Internal server error
 */
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
        const existingContact = await Contact.findOne({
            where: { user_id: fromUserId, friend_id: to_user_id },
        });
        if (existingContact) {
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
                await Contact.bulkCreate([
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

/**
 * @swagger
 * /friends/requests:
 *   get:
 *     summary: Get friend requests
 *     description: Retrieves pending friend requests (sent or received)
 *     tags:
 *       - Friends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [sent, received]
 *     responses:
 *       200:
 *         description: Friend requests retrieved
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
 *                       from_user_id:
 *                         type: integer
 *                       to_user_id:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       fromUser:
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
 *                       toUser:
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
 *         description: Invalid type parameter
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /friends/request/{id}:
 *   put:
 *     summary: Accept or reject a friend request
 *     description: Handles a pending friend request by accepting or rejecting it
 *     tags:
 *       - Friends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected]
 *     responses:
 *       200:
 *         description: Request handled successfully
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
 *         description: Invalid status parameter
 *       403:
 *         description: Cannot handle this request (not the recipient)
 *       404:
 *         description: Friend request not found
 *       409:
 *         description: Request already handled
 *       500:
 *         description: Internal server error
 */
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
                await Contact.bulkCreate([
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

/**
 * @swagger
 * /friends:
 *   get:
 *     summary: Get friends list
 *     description: Retrieves all friends with their online status
 *     tags:
 *       - Friends
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Friends list retrieved
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
 *                       username:
 *                         type: string
 *                       display_name:
 *                         type: string
 *                       avatar_locator:
 *                         type: string
 *                       is_online:
 *                         type: boolean
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const contacts = await Contact.findAll({
            where: { user_id: req.userId! },
            include: [
                {
                    model: User,
                    as: 'friend',
                    attributes: ['id', 'username', 'display_name', 'avatar_locator'],
                },
            ],
        });
        const friends = contacts.map((f: any) => { // definately safe
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

/**
 * @swagger
 * /friends/{userId}:
 *   delete:
 *     summary: Remove a friend
 *     description: Removes a user from the friends list
 *     tags:
 *       - Friends
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
 *         description: Friend removed successfully
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
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:userId', async (req: AuthRequest, res: Response) => {
    try {
        const friendUserId = parseInt(req.params.userId);
        const userId = req.userId!;
        if (isNaN(friendUserId)) {
            return error(res, 'INVALID_PARAMS', 'Invalid user ID', 400);
        }
        const deleted = await Contact.destroy({
            where: {
                [Op.or]: [
                    { user_id: userId, friend_id: friendUserId },
                    { user_id: friendUserId, friend_id: userId },
                ],
            },
        });
        if (deleted === 0) {
            return error(res, 'NOT_FOUND', 'Contact not found', 404);
        }
        return success(res, { message: 'Friend removed' });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /friends/addcode:
 *   get:
 *     summary: Generate a new add code
 *     description: Generates a new 8-digit verification code for adding friends. Automatically invalidates any previous code for this user.
 *     tags:
 *       - Friends
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Code generated successfully
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
 *                     code:
 *                       type: integer
 *                       description: 8-digit verification code
 *                     expireAt:
 *                       type: integer
 *                       description: Unix timestamp when code expires
 *       500:
 *         description: Internal server error
 */
router.get('/addcode', async (req: AuthRequest, res: Response) => {
    try {
        const userId = String(req.userId!);
        const addCode = AddCode.createCode(userId, true);
        return success(res, {
            code: addCode.code,
            expireAt: addCode.expireAt,
        });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /friends/addcode/{code}:
 *   post:
 *     summary: Get user who created this add code
 *     description: Retrieves the user profile information of the person who created the add code, along with the code's expiration time.
 *     tags:
 *       - Friends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           description: 8-digit verification code
 *     responses:
 *       200:
 *         description: Code verified, returns creator's user profile and expiration time
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
 *                     expireAt:
 *                       type: integer
 *                       description: Unix timestamp when code expires
 *       400:
 *         description: Invalid code format
 *       401:
 *         description: Code is invalid or expired
 *       404:
 *         description: Creator user not found
 *       500:
 *         description: Internal server error
 */
router.post('/addcode/:code', async (req: AuthRequest, res: Response) => {
    try {
        const code = parseInt(req.params.code);

        if (isNaN(code)) {
            return error(res, 'INVALID_PARAMS', 'Invalid code format', 400);
        }

        const codeInfo = AddCode.getCodeInfo(code);
        if (!codeInfo) {
            return error(res, 'UNAUTHORIZED', 'Code is invalid or expired', 401);
        }

        const creatorUserId = parseInt(codeInfo.ofUser);
        const creator = await User.findByPk(creatorUserId, {
            attributes: ['id', 'username', 'display_name', 'avatar_locator'],
        });
        if (!creator) {
            return error(res, 'NOT_FOUND', 'Creator user not found', 404);
        }

        return success(res, {
            ...creator.toJSON(),
            expireAt: codeInfo.expireAt,
        });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /friends/addcode/{code}:
 *   put:
 *     summary: Verify code and send friend request
 *     description: Verifies add code and sends friend request to target user. Code is consumed after successful verification. Ignores privacy settings.
 *     tags:
 *       - Friends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           description: 8-digit verification code
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *             description: Target user ID as raw text integer
 *     responses:
 *       201:
 *         description: Friend request sent successfully
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
 *                     message:
 *                       type: string
 *                     auto_accepted:
 *                       type: boolean
 *       400:
 *         description: Invalid code or target user ID format
 *       401:
 *         description: Code is invalid, expired, or does not match
 *       403:
 *         description: Unable to send request (blocked or blocks you, or trying to add self)
 *       404:
 *         description: Target user not found
 *       409:
 *         description: Already friends or request already exists
 *       500:
 *         description: Internal server error
 */
router.put('/addcode/:code', express.text(), async (req: AuthRequest, res: Response) => {
    try {
        const code = parseInt(req.params.code);
        const targetUserIdStr = String(req.body).trim();
        const targetUserId = parseInt(targetUserIdStr);
        const fromUserId = req.userId!;

        if (isNaN(code)) {
            return error(res, 'INVALID_PARAMS', 'Invalid code format', 400);
        }
        if (isNaN(targetUserId)) {
            return error(res, 'INVALID_PARAMS', 'Invalid target user ID format', 400);
        }

        const targetUserIdString = String(targetUserId);
        if (!AddCode.isValid(targetUserIdString, code)) {
            return error(res, 'UNAUTHORIZED', 'Code is invalid, expired, or does not match', 401);
        }

        // Consume the code
        AddCode.consume(targetUserIdString, code);

        if (targetUserId === fromUserId) {
            return error(res, 'FORBIDDEN', 'You cannot add yourself as a friend', 403);
        }

        const targetUser = await User.findByPk(targetUserId);
        if (!targetUser) {
            return error(res, 'NOT_FOUND', 'Target user not found', 404);
        }

        const blocked = await Block.findOne({
            where: {
                [Op.or]: [
                    { user_id: fromUserId, blocked_user_id: targetUserId },
                    { user_id: targetUserId, blocked_user_id: fromUserId },
                ],
            },
        });
        if (blocked) {
            return error(res, 'FORBIDDEN', 'Unable to send friend request', 403);
        }

        const existingContact = await Contact.findOne({
            where: { user_id: fromUserId, friend_id: targetUserId },
        });
        if (existingContact) {
            return error(res, 'CONFLICT', 'You are already friends', 409);
        }

        const existingRequest = await FriendRequest.findOne({
            where: { from_user_id: fromUserId, to_user_id: targetUserId, status: 'pending' },
        });
        if (existingRequest) {
            return error(res, 'CONFLICT', 'A pending friend request already exists', 409);
        }

        // Check for reverse request (mutual request) - skip privacy settings check for add code
        const reverseRequest = await FriendRequest.findOne({
            where: { from_user_id: targetUserId, to_user_id: fromUserId, status: 'pending' },
        });
        if (reverseRequest) {
            await sequelize.transaction(async (t) => {
                await reverseRequest.update({ status: 'accepted' }, { transaction: t });
                await FriendRequest.create({ from_user_id: fromUserId, to_user_id: targetUserId, status: 'accepted' }, { transaction: t });
                await Contact.bulkCreate([
                    { user_id: fromUserId, friend_id: targetUserId },
                    { user_id: targetUserId, friend_id: fromUserId },
                ], { transaction: t });
            });
            if (isUserOnline(fromUserId)) {
                emitToUser(fromUserId, 'friend:accepted', { userId: targetUserId });
            }
            if (isUserOnline(targetUserId)) {
                emitToUser(targetUserId, 'friend:accepted', { userId: fromUserId });
            }
            return success(res, { message: 'Mutual requests detected. You are now friends automatically', auto_accepted: true }, 201);
        }

        const request = await FriendRequest.create({
            from_user_id: fromUserId,
            to_user_id: targetUserId,
        });
        if (isUserOnline(targetUserId)) {
            const fromUser = await User.findByPk(fromUserId, {
                attributes: ['id', 'username', 'display_name', 'avatar_locator'],
            });
            emitToUser(targetUserId, 'friend:request', {
                id: request.id,
                fromUser,
            });
        }
        return success(res, { id: request.id, message: 'Friend request sent', auto_accepted: false }, 201);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

export default router;
