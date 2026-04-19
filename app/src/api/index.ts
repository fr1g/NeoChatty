import client, { BASE_URL, appendAccessToken, getAuthHeaders, getTokens } from './client';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import type { ApiResponse, LoginResponse, User, UserProfile, PrivacySettings, FriendRequest, Message, Conversation, } from '../types';
type UploadResponse = ApiResponse<{
    locator: string;
    original_name: string;
    file_size: number;
    mime_type: string;
}>;
export type UploadFilePayload = {
    uri: string;
    name: string;
    type: string;
};
function parseJsonSafely<T>(value: string): T | string | null {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value) as T;
    }
    catch {
        return value;
    }
}
async function uploadWithNativeTask(file: UploadFilePayload, onUploadProgress?: (progress: number) => void): Promise<{
    data: UploadResponse;
}> {
    const { accessToken } = await getTokens();
    const url = `${BASE_URL}/files/upload`;
    try {
        const options = {
            fieldName: 'file',
            mimeType: file.type,
            httpMethod: 'POST' as const,
            uploadType: LegacyFileSystem.FileSystemUploadType.MULTIPART,
            headers: accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : undefined,
            parameters: {
                original_name: file.name,
            },
        };
        const result = onUploadProgress
            ? await LegacyFileSystem.createUploadTask(url, file.uri, options, (progress) => {
                const total = progress.totalBytesExpectedToSend || 0;
                const sent = progress.totalBytesSent || 0;
                if (total > 0) {
                    onUploadProgress(Math.round((sent * 100) / total));
                }
            }).uploadAsync()
            : await LegacyFileSystem.uploadAsync(url, file.uri, options);
        const responseBody = result?.body || '';
        const payload = parseJsonSafely<UploadResponse>(responseBody);
        if (result?.status &&
            result.status >= 200 &&
            result.status < 300 &&
            payload &&
            typeof payload !== 'string') {
            return { data: payload };
        }
        throw {
            message: (typeof payload !== 'string' && payload?.error?.message) ||
                responseBody ||
                'Upload failed',
            response: {
                status: result?.status,
                data: payload,
            },
        };
    }
    catch (error: any) {
        throw error;
    }
}
export const auth = {
    register(username: string, password: string, display_name?: string) {
        return client.post<ApiResponse<LoginResponse>>('/auth/register', {
            username,
            password,
            display_name,
        });
    },
    login(username: string, password: string) {
        return client.post<ApiResponse<LoginResponse>>('/auth/login', {
            username,
            password,
        });
    },
    refreshToken(token: string) {
        return client.post<ApiResponse<{
            accessToken: string;
            refreshToken: string;
        }>>('/auth/refresh', { refreshToken: token });
    },
    changePassword(old_password: string, new_password: string) {
        return client.put<ApiResponse<null>>('/auth/password', {
            old_password,
            new_password,
        });
    },
};
export const users = {
    getMyProfile() {
        return client.get<ApiResponse<UserProfile>>('/users/me');
    },
    updateProfile(data: Partial<Pick<User, 'display_name' | 'avatar_locator' | 'background_locator'>>) {
        return client.put<ApiResponse<User>>('/users/me', data);
    },
    getMyPrivacy() {
        return client.get<ApiResponse<PrivacySettings>>('/users/me/privacy');
    },
    updatePrivacy(data: Partial<PrivacySettings>) {
        return client.put<ApiResponse<PrivacySettings>>('/users/me/privacy', data);
    },
    getUserProfile(id: number) {
        return client.get<ApiResponse<UserProfile>>(`/users/${id}`);
    },
    searchUsers(q: string, page?: number, limit?: number) {
        return client.get<ApiResponse<{
            users: UserProfile[];
            total: number;
        }>>('/users/search', { params: { q, page, limit } });
    },
};
export const friends = {
    sendFriendRequest(to_user_id: number) {
        return client.post<ApiResponse<FriendRequest>>('/friends/request', {
            to_user_id,
        });
    },
    getFriendRequests(type: 'received' | 'sent') {
        return client.get<ApiResponse<FriendRequest[]>>('/friends/requests', {
            params: { type },
        });
    },
    handleFriendRequest(id: number, status: 'accepted' | 'rejected') {
        return client.put<ApiResponse<FriendRequest>>(`/friends/request/${id}`, { status });
    },
    getFriends() {
        return client.get<ApiResponse<User[]>>('/friends');
    },
    deleteFriend(userId: number) {
        return client.delete<ApiResponse<null>>(`/friends/${userId}`);
    },
};
export const blocks = {
    blockUser(user_id: number) {
        return client.post<ApiResponse<null>>('/blocks', { user_id });
    },
    getBlocks() {
        return client.get<ApiResponse<User[]>>('/blocks');
    },
    unblockUser(userId: number) {
        return client.delete<ApiResponse<null>>(`/blocks/${userId}`);
    },
};
export const files = { // files {...filesx} and replace uploadFile, replace others and all inherit from main.ts(this app) the exported
    // or, move this to main.ts and expose all there.
    uploadFile(file: UploadFilePayload, onUploadProgress?: (progress: number) => void) {
        return uploadWithNativeTask(file, onUploadProgress);
    },
    getFileUrl(locator: string): string {
        return appendAccessToken(`${BASE_URL}/files/${locator}`);
    },
    getFileSource(locator: string) {
        return {
            uri: appendAccessToken(`${BASE_URL}/files/${locator}`),
            headers: getAuthHeaders(),
        };
    },
    async uploadAvatar(file: UploadFilePayload) {
        return uploadWithNativeTask(file);
    },
};
export const messages = {
    getMessages(friendId: number, before?: number, limit?: number) {
        return client.get<ApiResponse<Message[]>>(`/messages/${friendId}`, {
            params: { before, limit },
        });
    },
};
export const conversations = {
    getConversations() {
        return client.get<ApiResponse<Conversation[]>>('/conversations');
    },
};
