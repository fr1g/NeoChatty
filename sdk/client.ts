import axios, { AxiosInstance } from 'axios';

const ACCESS_TOKEN_KEY = 'access_token'; // never change
const REFRESH_TOKEN_KEY = 'refresh_token'; // never change
const SERVER_PORT = 5637; // never change
const REFRESH_EXCLUDED_PATHS = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
];

export class ChattyClientConfig {
    useHttps: boolean;
    endpoint: string;

    constructor(useHttps: boolean, endpoint: string) {
        this.useHttps = useHttps;
        this.endpoint = endpoint;
    }

    getApi(): string {
        return `http${this.useHttps ? 's' : ''}://${this.endpoint}:${SERVER_PORT}/api`;
    }

    getSocket(): string {
        return `http${this.useHttps ? 's' : ''}://${this.endpoint}:${SERVER_PORT}`;
    }
}

export type AuthExpiredCallback = () => void;

export type ApiClientType = null | "default" | "async";

export class ChattyClient {
    cachedAccessToken: string | null = null;
    cachedRefreshToken: string | null = null;
    config: ChattyClientConfig;
    client: AxiosInstance;
    onAuthExpired: AuthExpiredCallback | null = null;

    status: ApiClientType = null;

    isRefreshing: boolean = false;
    failedQueue: Array<{
        resolve: (token: string) => void;
        reject: (error: unknown) => void;
    }> = [];

    /**
     * Must call ChattyClient.init(...) or await ChattyClient.initAsync(...)
     * @param config 
     */
    constructor(config: ChattyClientConfig) {
        this.config = config;
        this.client = axios.create({
            baseURL: this.config.getApi(),
            timeout: 15000,
        });
    }

    setOnAuthExpired(cb: AuthExpiredCallback) {
        this.onAuthExpired = cb;
    }

    // Sync Methods
    setTokens(access: string, refresh: string, set: (key: string, value: string) => void): void {
        this.cachedAccessToken = access;
        this.cachedRefreshToken = refresh;
        set(ACCESS_TOKEN_KEY, access);
        set(REFRESH_TOKEN_KEY, refresh);
    }

    getTokens(get: (key: string) => string): {
        accessToken: string | null;
        refreshToken: string | null;
    } {
        if (!this.cachedAccessToken)
            this.cachedAccessToken = get(ACCESS_TOKEN_KEY);

        if (!this.cachedRefreshToken)
            this.cachedRefreshToken = get(REFRESH_TOKEN_KEY);

        return { accessToken: this.cachedAccessToken, refreshToken: this.cachedRefreshToken };
    }

    clearTokens(remove: (key: string) => void): void {
        this.cachedAccessToken = null;
        this.cachedRefreshToken = null;
        remove(ACCESS_TOKEN_KEY);
        remove(REFRESH_TOKEN_KEY);
    }

    // Async Methods
    async setTokensAsync(access: string, refresh: string, set: (key: string, value: string) => Promise<void>): Promise<void> {
        this.cachedAccessToken = access;
        this.cachedRefreshToken = refresh;
        await set(ACCESS_TOKEN_KEY, access);
        await set(REFRESH_TOKEN_KEY, refresh);
    }

    async getTokensAsync(get: (key: string) => Promise<string | null>): Promise<{
        accessToken: string | null;
        refreshToken: string | null;
    }> {
        if (!this.cachedAccessToken)
            this.cachedAccessToken = await get(ACCESS_TOKEN_KEY);

        if (!this.cachedRefreshToken)
            this.cachedRefreshToken = await get(REFRESH_TOKEN_KEY);

        return { accessToken: this.cachedAccessToken, refreshToken: this.cachedRefreshToken };
    }

    async clearTokensAsync(remove: (key: string) => Promise<void>): Promise<void> {
        this.cachedAccessToken = null;
        this.cachedRefreshToken = null;
        await remove(ACCESS_TOKEN_KEY);
        await remove(REFRESH_TOKEN_KEY);
    }

    // End Local RW related

    getAuthHeaders(get: (key: string) => string): Record<string, string> {
        const { accessToken } = this.getTokens(get);
        return this.appendAuthHeader(accessToken)
    }

    appendAccessToken(url: string, get: (key: string) => string): string {
        const { accessToken } = this.getTokens(get);
        if (!accessToken)
            return url;
        return this.appendAccessTokenUrl(url, accessToken);
    }

    //

    async getAuthHeadersAsync(get: (key: string) => Promise<string>): Promise<Record<string, string>> {
        const { accessToken } = await this.getTokensAsync(get);
        return this.appendAuthHeader(accessToken)
    }

    async appendAccessTokenAsync(url: string, get: (key: string) => Promise<string>): Promise<string> {
        const { accessToken } = await this.getTokensAsync(get);
        if (!accessToken)
            return url;
        return this.appendAccessTokenUrl(url, accessToken);
    }

    //

    appendAuthHeader(token: string | null | undefined): Record<string, string> {
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    appendAccessTokenUrl(url: string, token: string) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url.split('#')[0]}${separator}token=${encodeURIComponent(token)}`;
    }

    // 

    getAccessTokenSync(): string | null {
        return this.cachedAccessToken;
    }

    shouldSkipRefresh(url?: string): boolean {
        if (!url)
            return false;
        return REFRESH_EXCLUDED_PATHS.some((path) => url.includes(path));
    }

    processQueue(error: unknown, token: string | null = null) {
        this.failedQueue.forEach((promise) => {
            if (error) promise.reject(error);
            else promise.resolve(token!);
        });
        this.failedQueue = [];
    }



    // sync init
    initClient(set: (key: string, value: string) => void, get: (key: string) => string, remove: (key: string) => void) {
        const client = this.client;
        const rawUrl = this.config.getApi();
        client.interceptors.request.use((config) => {
            if (isFormDataPayload(config.data)) {
                delete config.headers?.['Content-Type'];
                delete config.headers?.['content-type'];
            }
            const { accessToken } = this.getTokens(get);
            if (accessToken)
                config.headers.Authorization = `Bearer ${accessToken}`;

            return config;
        });
        client.interceptors.response.use((response) => response, async (error) => {
            const originalRequest = error.config ?? {};
            if (error.response?.status !== 401 ||
                originalRequest._retry ||
                this.shouldSkipRefresh(originalRequest.url)) {
                return Promise.reject(error);
            }
            if (this.isRefreshing) {
                return new Promise<string>((resolve, reject) => {
                    this.failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers = originalRequest.headers ?? {};
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return client(originalRequest);
                });
            }
            originalRequest._retry = true;
            this.isRefreshing = true;
            try {
                const { refreshToken } = this.getTokens(get);
                if (!refreshToken) {
                    this.clearTokens(remove);
                    this.onAuthExpired?.();
                    return Promise.reject(error);
                }
                const { data } = await axios.post(`${rawUrl}/auth/refresh`, {
                    refreshToken,
                });
                const newAccess: string = data.data.accessToken;
                const newRefresh: string = data.data.refreshToken;
                this.setTokens(newAccess, newRefresh, set);
                this.processQueue(null, newAccess);
                originalRequest.headers = originalRequest.headers ?? {};
                originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                return client(originalRequest);
            }
            catch (refreshError) {
                this.processQueue(refreshError, null);
                this.clearTokens(remove);
                this.onAuthExpired?.();
                return Promise.reject(error);
            }
            finally {
                this.isRefreshing = false;
            }
        });

        this.status = "default";
    }

    // async init
    async initClientAsync(set: (key: string, value: string) => Promise<void>, get: (key: string) => Promise<string>, remove: (key: string) => Promise<void>) {
        const client = this.client;
        const rawUrl = this.config.getApi();
        client.interceptors.request.use(async (config) => {
            if (isFormDataPayload(config.data)) {
                delete config.headers?.['Content-Type'];
                delete config.headers?.['content-type'];
            }
            const { accessToken } = await this.getTokensAsync(get);
            if (accessToken)
                config.headers.Authorization = `Bearer ${accessToken}`;

            return config;
        });
        client.interceptors.response.use((response) => response, async (error) => {
            const originalRequest = error.config ?? {};
            if (error.response?.status !== 401 ||
                originalRequest._retry ||
                this.shouldSkipRefresh(originalRequest.url)) {
                return Promise.reject(error);
            }
            if (this.isRefreshing) {
                return new Promise<string>((resolve, reject) => {
                    this.failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers = originalRequest.headers ?? {};
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return client(originalRequest);
                });
            }
            originalRequest._retry = true;
            this.isRefreshing = true;
            try {
                const { refreshToken } = await this.getTokensAsync(get);
                if (!refreshToken) {
                    await this.clearTokensAsync(remove);
                    this.onAuthExpired?.();
                    return Promise.reject(error);
                }
                const { data } = await axios.post(`${rawUrl}/auth/refresh`, {
                    refreshToken,
                });
                const newAccess: string = data.data.accessToken;
                const newRefresh: string = data.data.refreshToken;
                await this.setTokensAsync(newAccess, newRefresh, set);
                this.processQueue(null, newAccess);
                originalRequest.headers = originalRequest.headers ?? {};
                originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                return client(originalRequest);
            }
            catch (refreshError) {
                this.processQueue(refreshError, null);
                await this.clearTokensAsync(remove);
                this.onAuthExpired?.();
                return Promise.reject(error);
            }
            finally {
                this.isRefreshing = false;
            }
        });

        this.status = "async";
    }

}

export function isFormDataPayload(data: unknown): boolean {
    return typeof FormData !== 'undefined' && data instanceof FormData;
}

// export default client;
