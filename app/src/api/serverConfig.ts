import { ChattyClientConfig } from 'chatty-sdk';
import { getter, setter } from './mapio';

const CONFIG_STORAGE_KEY = 'chattyClientConfig';

export async function readServerConfig(): Promise<ChattyClientConfig | null> {
    try {
        const raw = await getter(CONFIG_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as ChattyClientConfig;
        if (!(parsed instanceof ChattyClientConfig)) {
            const config = new ChattyClientConfig(parsed.useHttps, parsed.endpoint);
            if (config.endpoint && typeof config.useHttps === 'boolean') {
                return config;
            }
        }
        return null;
    } catch (error) {
        console.warn('Failed to read server config:', error);
        return null;
    }
}

export async function saveServerConfig(
    endpoint: string,
    useHttps: boolean
): Promise<void> {
    try {
        const config = new ChattyClientConfig(useHttps, endpoint);
        await setter(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
        console.error('Failed to save server config:', error);
        throw error;
    }
}

export async function clearServerConfig(): Promise<void> {
    try {
        await setter(CONFIG_STORAGE_KEY, '');
    } catch (error) {
        console.error('Failed to clear server config:', error);
    }
}

export function buildApiUrl(endpoint: string, useHttps: boolean): string {
    const protocol = useHttps ? 'https' : 'http';
    return `${protocol}://${endpoint}:5637`;
}

export function buildSocketUrl(endpoint: string, useHttps: boolean): string {
    const protocol = useHttps ? 'wss' : 'ws';
    return `${protocol}://${endpoint}:5637/chathub`;
}
