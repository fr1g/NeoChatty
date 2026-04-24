import client, { BASE_URL, appendAccessToken, getAuthHeaders } from './client';
// import type { ApiResponse, LoginResponse, User, UserProfile, PrivacySettings, FriendRequest, Message, Conversation, } from '../types';
import type { ApiResponse, LoginResponse, User, UserProfile, PrivacySettings, FriendRequest, Message, Conversation, } from 'chatty-sdk';
type UploadResponse = ApiResponse<{
    locator: string;
    original_name: string;
    file_size: number;
    mime_type: string;
}>;
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
export const files = {
    uploadFile(file: File, onUploadProgress?: (progress: number) => void) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('original_name', file.name);
        return client.post<UploadResponse>('/files/upload', formData, {
            onUploadProgress: onUploadProgress
                ? (e) => {
                    const total = e.total || 0;
                    const loaded = e.loaded || 0;
                    if (total > 0) {
                        onUploadProgress(Math.round((loaded * 100) / total));
                    }
                }
                : undefined,
        });
    },
    getFileUrl(locator: string): string {
        return appendAccessToken(`${BASE_URL}/files/${locator}`);
    },
    getAuthHeaders() {
        return getAuthHeaders();
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
