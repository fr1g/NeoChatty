import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
const MIME_BY_EXT: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    '3gp': 'video/3gpp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    txt: 'text/plain',
};
const MIME_ALIASES: Record<string, string> = {
    'image/jpg': 'image/jpeg',
};
const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'text/plain': 'txt',
};
const GENERIC_MIME_TYPES = new Set([
    'application/octet-stream',
    'image/*',
    'video/*',
    '*/*',
]);
export function inferMimeTypeFromName(fileName?: string | null, fallback = 'application/octet-stream'): string {
    const cleanFileName = fileName?.split('?')[0] || '';
    const ext = cleanFileName.split('.').pop()?.toLowerCase();
    return (ext && MIME_BY_EXT[ext]) || fallback;
}
export function resolveUploadMimeType(fileName?: string | null, providedMimeType?: string | null, fallback = 'application/octet-stream'): string {
    const normalizedMime = providedMimeType?.toLowerCase();
    if (!normalizedMime || GENERIC_MIME_TYPES.has(normalizedMime)) {
        return inferMimeTypeFromName(fileName, fallback);
    }
    return MIME_ALIASES[normalizedMime] || normalizedMime;
}
function getFileExtension(fileName?: string | null): string | null {
    const cleanFileName = fileName?.split('?')[0] || '';
    const ext = cleanFileName.split('.').pop()?.toLowerCase();
    return ext && cleanFileName.includes('.') ? ext : null;
}
function ensureFileName(fileName: string | null | undefined, mimeType: string, fallbackBase = 'upload'): string {
    const ext = getFileExtension(fileName) || EXT_BY_MIME[mimeType];
    const baseName = fileName?.trim() || `${fallbackBase}.${ext || 'bin'}`;
    if (getFileExtension(baseName) || !ext) {
        return baseName;
    }
    return `${baseName}.${ext}`;
}
export async function normalizeUploadAsset(params: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    fallbackMimeType?: string;
    fallbackBaseName?: string;
}): Promise<{
    uri: string;
    fileName: string;
    mimeType: string;
    cleanupUri?: string;
}> {
    const mimeType = resolveUploadMimeType(params.fileName || params.uri, params.mimeType, params.fallbackMimeType || 'application/octet-stream');
    const fileName = ensureFileName(params.fileName, mimeType, params.fallbackBaseName || 'upload');
    if (Platform.OS !== 'android' || !params.uri.startsWith('content://')) {
        return {
            uri: params.uri,
            fileName,
            mimeType,
        };
    }
    if (!LegacyFileSystem.cacheDirectory) {
        throw new Error('Cache directory is unavailable and Android content URIs cannot be processed');
    }
    const copiedUri = `${LegacyFileSystem.cacheDirectory}upload-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${getFileExtension(fileName) || 'bin'}`;
    await LegacyFileSystem.copyAsync({
        from: params.uri,
        to: copiedUri,
    });
    const info = await LegacyFileSystem.getInfoAsync(copiedUri);
    if (!info.exists) {
        throw new Error('Failed to copy the Android local file');
    }
    return {
        uri: copiedUri,
        fileName,
        mimeType,
        cleanupUri: copiedUri,
    };
}
export function getApiErrorMessage(error: any, fallback: string): string {
    return error?.response?.data?.error?.message || error?.message || fallback;
}
