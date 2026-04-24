import * as Client from './client';
import * as Classes from './class';
import * as Api from './api';
import * as Socket from './socket';

export { Client, Classes as ChattyModel, Api, Socket as ChattySocket };

export { ChattyClient, ChattyClientConfig } from './client';

export {
    User,
    PrivacySettings,
    UserProfile,
    FriendRequest,
    Message,
    Conversation,
    ApiResponse,
    AuthTokens,
    LoginResponse,
    UploadResponse
} from './class';

export const ConstructClient = Api.constructClient;
// export type AuthExpiredCallback = AuthExpiredCallback

import { ChattyClientConfig } from './client';
export const DEFAULT_CLIENT_CONFIG = new ChattyClientConfig(false, 'rus.kami.su');