import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { error } from '../utils/response';
const JWT_SECRET = 'chat_app_jwt_secret_key_2024';
const JWT_REFRESH_SECRET = 'chat_app_jwt_refresh_secret_key_2024';
const ACCESS_TOKEN_EXPIRES = '2h';
const REFRESH_TOKEN_EXPIRES = '7d';
export { JWT_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_EXPIRES, REFRESH_TOKEN_EXPIRES };
export interface JwtPayload {
    userId: number;
    tokenVersion: number;
}
export interface AuthRequest extends Request {
    userId?: number;
}
async function validateToken(token: string): Promise<JwtPayload | null> {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        const user = await User.findByPk(decoded.userId, {
            attributes: ['id', 'token_version'],
        });
        if (!user || user.token_version !== decoded.tokenVersion) {
            return null;
        }
        return decoded;
    }
    catch {
        return null;
    }
}
function getBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}
export function generateAccessToken(userId: number, tokenVersion: number): string {
    return jwt.sign({ userId, tokenVersion }, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRES,
    });
}
export function generateRefreshToken(userId: number, tokenVersion: number): string {
    return jwt.sign({ userId, tokenVersion }, JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES,
    });
}
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
        return error(res, 'UNAUTHORIZED', 'Missing authentication token', 401);
    }
    const decoded = await validateToken(token);
    if (!decoded) {
        return error(res, 'UNAUTHORIZED', 'Token is invalid or expired', 401);
    }
    req.userId = decoded.userId;
    next();
}
export async function fileAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const headerToken = getBearerToken(req.headers.authorization);
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const token = headerToken || queryToken;
    if (!token) {
        return error(res, 'UNAUTHORIZED', 'Missing authentication token', 401);
    }
    const decoded = await validateToken(token);
    if (!decoded) {
        return error(res, 'UNAUTHORIZED', 'Token is invalid or expired', 401);
    }
    req.userId = decoded.userId;
    next();
}
