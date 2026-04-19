import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/network';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
export const BASE_URL = API_BASE_URL;
let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
const client = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
});
// SecureStore.
function isFormDataPayload(data: unknown): boolean {
    return typeof FormData !== 'undefined' && data instanceof FormData;
}
export async function setTokens(access: string, refresh: string): Promise<void> {
    cachedAccessToken = access;
    cachedRefreshToken = refresh;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}
export async function getTokens(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
}> {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    cachedAccessToken = accessToken;
    cachedRefreshToken = refreshToken;
    return { accessToken, refreshToken };
}
export async function clearTokens(): Promise<void> {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
export function getAccessTokenSync(): string | null {
    return cachedAccessToken;
}
export function getAuthHeaders(): Record<string, string> {
    return cachedAccessToken
        ? { Authorization: `Bearer ${cachedAccessToken}` }
        : {};
}
export function appendAccessToken(url: string): string {
    if (!cachedAccessToken) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(cachedAccessToken)}`;
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
    if (!url) {
        return false;
    }
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
client.interceptors.request.use(async (config) => {
    if (isFormDataPayload(config.data)) {
        delete config.headers?.['Content-Type'];
        delete config.headers?.['content-type'];
    }
    const accessToken = cachedAccessToken ?? (await getTokens()).accessToken;
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
        const { refreshToken } = await getTokens();
        if (!refreshToken) {
            await clearTokens();
            onAuthExpired?.();
            return Promise.reject(error);
        }
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
            refreshToken,
        });
        const newAccess: string = data.data.accessToken;
        const newRefresh: string = data.data.refreshToken;
        await setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return client(originalRequest);
    }
    catch (refreshError) {
        processQueue(refreshError, null);
        await clearTokens();
        onAuthExpired?.();
        return Promise.reject(error);
    }
    finally {
        isRefreshing = false;
    }
});
export default client;
