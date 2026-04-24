import axios from 'axios';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const SERVER_PORT = 5637;
const USE_HTTPS = false;

function resolveApiOrigin(): string {
    const hostname = globalThis.location?.hostname || 'localhost';
    return `http${USE_HTTPS ? 's' : ''}://${hostname}:${SERVER_PORT}`;
}
export const API_ORIGIN = resolveApiOrigin();
export const BASE_URL = `${API_ORIGIN}/api`;
export const SOCKET_BASE_URL = `${API_ORIGIN}/chathub`;
let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
const client = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
});
function isFormDataPayload(data: unknown): boolean {
    return typeof FormData !== 'undefined' && data instanceof FormData;
}
export function setTokens(access: string, refresh: string): void {
    cachedAccessToken = access;
    cachedRefreshToken = refresh;
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}
export function getTokens(): {
    accessToken: string | null;
    refreshToken: string | null;
} {
    if (!cachedAccessToken) {
        cachedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    }
    if (!cachedRefreshToken) {
        cachedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return { accessToken: cachedAccessToken, refreshToken: cachedRefreshToken };
}
export function clearTokens(): void {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}
export function getAccessTokenSync(): string | null {
    return cachedAccessToken;
}
export function getAuthHeaders(): Record<string, string> {
    const { accessToken } = getTokens();
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
export function appendAccessToken(url: string): string {
    const { accessToken } = getTokens();
    if (!accessToken)
        return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(accessToken)}`;
}
type AuthExpiredCallback = () => void;
let onAuthExpired: AuthExpiredCallback | null = null;
export function setOnAuthExpired(cb: AuthExpiredCallback) {
    onAuthExpired = cb;
}
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}> = [];
const REFRESH_EXCLUDED_PATHS = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
];
function shouldSkipRefresh(url?: string): boolean {
    if (!url)
        return false;
    return REFRESH_EXCLUDED_PATHS.some((path) => url.includes(path));
}
function processQueue(error: unknown, token: string | null = null) {
    failedQueue.forEach((promise) => {
        if (error) {
            promise.reject(error);
        }
        else {
            promise.resolve(token!);
        }
    });
    failedQueue = [];
}
client.interceptors.request.use((config) => {
    if (isFormDataPayload(config.data)) {
        delete config.headers?.['Content-Type'];
        delete config.headers?.['content-type'];
    }
    const { accessToken } = getTokens();
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});
client.interceptors.response.use((response) => response, async (error) => {
    const originalRequest = error.config ?? {};
    if (error.response?.status !== 401 ||
        originalRequest._retry ||
        shouldSkipRefresh(originalRequest.url)) {
        return Promise.reject(error);
    }
    if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        }).then((token) => {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
        });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    try {
        const { refreshToken } = getTokens();
        if (!refreshToken) {
            clearTokens();
            onAuthExpired?.();
            return Promise.reject(error);
        }
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
            refreshToken,
        });
        const newAccess: string = data.data.accessToken;
        const newRefresh: string = data.data.refreshToken;
        setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return client(originalRequest);
    }
    catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        onAuthExpired?.();
        return Promise.reject(error);
    }
    finally {
        isRefreshing = false;
    }
});
export default client;
