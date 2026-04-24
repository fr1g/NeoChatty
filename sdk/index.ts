import * as Client from './client';
import * as Classes from './class';
import * as Api from './api';

export { Client, Classes as ChattyModel, Api };

export type ChattyClient = Client.ChattyClient;
export type ChattyClientConfig = Client.ChattyClientConfig;

export type User = Classes.User;
export type PrivacySettings = Classes.PrivacySettings;
export type UserProfile = Classes.UserProfile;
export type FriendRequest = Classes.FriendRequest;
export type Message = Classes.Message;
export type Conversation = Classes.Conversation;
export type ApiResponse<T> = Classes.ApiResponse<T>;
export type AuthTokens = Classes.AuthTokens;
export type LoginResponse = Classes.LoginResponse;
export type UploadResponse = Classes.UploadResponse;

export const ConstructClient = Api.constructClient;