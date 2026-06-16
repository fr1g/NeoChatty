import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, PrivacySetting } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, generateAccessToken, generateRefreshToken, JWT_REFRESH_SECRET, JwtPayload, AuthRequest, } from '../middleware/auth';
import sequelize from '../config/database';
import { disconnectUser } from '../socket';

const router: Router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     description: Creates a new user account with username, password, and optional display name
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username (3-20 chars, alphanumeric and underscore only)
 *               password:
 *                 type: string
 *                 description: Password (minimum 6 characters)
 *               display_name:
 *                 type: string
 *                 description: Display name (optional, max 50 chars)
 *     responses:
 *       201:
 *         description: User successfully registered
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                         display_name:
 *                           type: string
 *                         avatar_locator:
 *                           type: string
 *                         background_locator:
 *                           type: string
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Invalid input parameters
 *       409:
 *         description: Username already exists
 *       500:
 *         description: Internal server error
 */
router.post('/register', async (req, res) => {
    try {
        const { username, password, display_name } = req.body;
        if (!username || !password) {
            return error(res, 'INVALID_PARAMS', 'Username and password are required', 400);
        }
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            return error(res, 'INVALID_PARAMS', 'Username must be 3-20 characters using letters, numbers, or underscores', 400);
        }
        if (password.length < 6) {
            return error(res, 'INVALID_PARAMS', 'Password must be at least 6 characters', 400);
        }
        const normalizedUsername = username.toLowerCase();
        const existing = await User.findOne({ where: { username: normalizedUsername } });
        if (existing) {
            return error(res, 'CONFLICT', 'Username already exists', 409);
        }
        const displayName = display_name?.trim() || normalizedUsername;
        if (displayName.length > 50) {
            return error(res, 'INVALID_PARAMS', 'Display name must be 50 characters or fewer', 400);
        }
        const password_hash = await bcrypt.hash(password, 10);
        const result = await sequelize.transaction(async (t) => {
            const user = await User.create({
                username: normalizedUsername,
                display_name: displayName,
                password_hash,
            }, { transaction: t });
            await PrivacySetting.create({ user_id: user.id }, { transaction: t });
            return user;
        });
        const accessToken = generateAccessToken(result.id, result.token_version);
        const refreshToken = generateRefreshToken(result.id, result.token_version);
        return success(res, {
            user: {
                id: result.id,
                username: result.username,
                display_name: result.display_name,
                avatar_locator: result.avatar_locator,
                background_locator: result.background_locator,
            },
            accessToken,
            refreshToken,
        }, 201);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with username and password
 *     description: Authenticates a user and returns access/refresh tokens
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                         display_name:
 *                           type: string
 *                         avatar_locator:
 *                           type: string
 *                         background_locator:
 *                           type: string
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return error(res, 'INVALID_PARAMS', 'Username and password are required', 400);
        }
        const normalizedUsername = username.toLowerCase();
        const user = await User.findOne({ where: { username: normalizedUsername } });
        if (!user) {
            return error(res, 'UNAUTHORIZED', 'Invalid username or password', 401);
        }
        if (user.disabled) {
            return error(res, 'FORBIDDEN', 'This account has been disabled', 403);
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return error(res, 'UNAUTHORIZED', 'Invalid username or password', 401);
        }
        const accessToken = generateAccessToken(user.id, user.token_version);
        const refreshToken = generateRefreshToken(user.id, user.token_version);
        return success(res, {
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                avatar_locator: user.avatar_locator,
                background_locator: user.background_locator,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     description: Generates new access and refresh tokens using a valid refresh token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
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
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Missing refresh token
 *       401:
 *         description: Refresh token invalid or expired
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return error(res, 'INVALID_PARAMS', 'Refresh token is required', 400);
        }
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;
        const user = await User.findByPk(decoded.userId, {
            attributes: ['id', 'token_version', 'disabled'],
        });
        if (!user || user.token_version !== decoded.tokenVersion || user.disabled) {
            return error(res, 'UNAUTHORIZED', 'Refresh token has expired', 401);
        }
        const newAccessToken = generateAccessToken(user.id, user.token_version);
        const newRefreshToken = generateRefreshToken(user.id, user.token_version);
        return success(res, {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    }
    catch {
        return error(res, 'UNAUTHORIZED', 'Refresh token is invalid or expired', 401);
    }
});

/**
 * @swagger
 * /auth/password:
 *   put:
 *     summary: Change user password
 *     description: Updates user password. Requires authentication and old password verification.
 *     tags:
 *       - Authentication
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - old_password
 *               - new_password
 *             properties:
 *               old_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *                 description: Minimum 6 characters
 *     responses:
 *       200:
 *         description: Password changed successfully
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
 *         description: Invalid input parameters
 *       401:
 *         description: Old password is incorrect or user not found
 *       500:
 *         description: Internal server error
 */
router.put('/password', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { old_password, new_password } = req.body;
        if (!old_password || !new_password) {
            return error(res, 'INVALID_PARAMS', 'Old password and new password are required', 400);
        }
        if (new_password.length < 6) {
            return error(res, 'INVALID_PARAMS', 'New password must be at least 6 characters', 400);
        }
        const user = await User.findByPk(req.userId!);
        if (!user) {
            return error(res, 'NOT_FOUND', 'User not found', 404);
        }
        const valid = await bcrypt.compare(old_password, user.password_hash);
        if (!valid) {
            return error(res, 'UNAUTHORIZED', 'Old password is incorrect', 401);
        }
        const password_hash = await bcrypt.hash(new_password, 10);
        await user.update({
            password_hash,
            token_version: user.token_version + 1,
        });
        disconnectUser(user.id);
        return success(res, { message: 'Password changed successfully. Please sign in again' });
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Internal server error', 500);
    }
});
export default router;
