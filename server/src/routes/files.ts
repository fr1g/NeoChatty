import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { File } from '../models';
import { success, error } from '../utils/response';
import { authMiddleware, AuthRequest, fileAuthMiddleware } from '../middleware/auth';
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIMES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/3gpp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-rar-compressed',
    'text/plain',
];
const BLOCKED_EXTENSIONS = ['.exe', '.sh', '.bat', '.cmd', '.com', '.msi'];
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const timestamp = Date.now();
        const hash = crypto
            .createHash('md5')
            .update(`${file.originalname}${timestamp}${Math.random()}`)
            .digest('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${hash}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            return cb(new Error('Executable files are not allowed'));
        }
        if (!ALLOWED_MIMES.includes(file.mimetype)) {
            return cb(new Error('Unsupported file type'));
        }
        cb(null, true);
    },
});

const router: Router = Router();
function resolveOriginalName(rawName: unknown, fallbackName: string): string {
    if (typeof rawName !== 'string') {
        return fallbackName;
    }
    const trimmedName = rawName.trim();
    if (!trimmedName) {
        return fallbackName;
    }
    return path.basename(trimmedName);
}
router.post('/upload', authMiddleware, (req: AuthRequest, res: Response) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return error(res, 'FILE_TOO_LARGE', 'File size must not exceed 50 MB', 413);
            }
            return error(res, 'UNSUPPORTED_FILE_TYPE', err.message || 'File upload failed', 415);
        }
        if (!req.file) {
            return error(res, 'INVALID_PARAMS', 'No file uploaded', 400);
        }
        try {
            const originalName = resolveOriginalName(req.body?.original_name, req.file.originalname);
            const fileContent = fs.readFileSync(req.file.path);
            const contentHash = crypto.createHash('md5').update(fileContent).digest('hex');
            const locator = crypto
                .createHash('md5')
                .update(`${contentHash}${originalName}${Date.now()}`)
                .digest('hex');
            const file = await File.create({
                locator,
                original_name: originalName,
                storage_path: req.file.path,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                uploader_id: req.userId!,
            });
            return success(res, {
                locator: file.locator,
                original_name: file.original_name,
                file_size: file.file_size,
                mime_type: file.mime_type,
            }, 201);
        }
        catch (err) {
            return error(res, 'SERVER_ERROR', 'Failed to save file', 500);
        }
    });
});
router.get('/:locator', fileAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const file = await File.findOne({
            where: { locator: req.params.locator },
        });
        if (!file) {
            return error(res, 'NOT_FOUND', 'File not found', 404);
        }
        if (!fs.existsSync(file.storage_path)) {
            return error(res, 'NOT_FOUND', 'File has been deleted', 404);
        }
        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
        res.sendFile(file.storage_path);
    }
    catch (err) {
        return error(res, 'SERVER_ERROR', 'Failed to download file', 500);
    }
});
export default router;
