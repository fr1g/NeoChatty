import { Response } from 'express';
export function success(res: Response, data: any = null, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        data,
    });
}
export function error(res: Response, code: string, message: string, statusCode = 400) {
    return res.status(statusCode).json({
        success: false,
        error: { code, message },
    });
}
export const ErrorCodes = {
    INVALID_PARAMS: { code: 'INVALID_PARAMS', status: 400 },
    UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
    FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
    NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
    CONFLICT: { code: 'CONFLICT', status: 409 },
    FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', status: 413 },
    UNSUPPORTED_FILE_TYPE: { code: 'UNSUPPORTED_FILE_TYPE', status: 415 },
    SERVER_ERROR: { code: 'SERVER_ERROR', status: 500 },
} as const;
