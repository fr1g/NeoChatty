export interface User {
    id: number;
    username: string;
    display_name: string;
    avatar_locator: string | null;
    background_locator: string | null;
    is_online?: boolean;
}
export interface PrivacySettings {
    searchable_by_username: boolean;
    searchable_by_display_name: boolean;
    show_avatar_to_strangers: boolean;
}
export interface UserProfile extends User {
    privacy?: PrivacySettings;
    relationship?: 'friend' | 'pending_sent' | 'pending_received' | 'stranger' | 'blocked';
    friend_request_id?: number;
}
export interface FriendRequest {
    id: number;
    from_user_id: number;
    to_user_id: number;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
    updated_at: string;
    createdAt?: string;
    updatedAt?: string;
    fromUser?: User;
    toUser?: User;
}
export interface Message {
    id: number;
    sender_id: number;
    receiver_id: number;
    type: 'text' | 'image' | 'video' | 'file';
    content: string | null;
    file_locator: string | null;
    file_name: string | null;
    file_size: number | null;
    is_recalled: boolean;
    is_read: boolean;
    created_at: string;
    sender?: User;
    _tempId?: number;
    _localUri?: string | null;
}
export interface Conversation {
    id: number;
    user_id: number;
    peer_id: number;
    last_message_id: number | null;
    unread_count: number;
    updated_at: string;
    peer?: User;
    lastMessage?: Message;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface LoginResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}

export type UploadResponse = ApiResponse<{
    locator: string;
    original_name: string;
    file_size: number;
    mime_type: string;
}>;
export type AddCodeResponse = ApiResponse<{
    code: number;
    expireAt: number;
}>;

export class AddCode {
    code: number | null = null;
    expireAt: number = 0;

    constructor(code?: number, expireAt?: number) {
        this.code = code ?? null;
        this.expireAt = expireAt ?? 0;
    }

    toStringPair(): [string, string] {
        return [`${this.code ?? '-'}`, `${this.expireAt ?? '-'}`];
    }
}