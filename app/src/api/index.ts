import { ApiResponse, ConstructClient } from "chatty-sdk";

import { ChattyClient, ChattyClientConfig, DEFAULT_CLIENT_CONFIG } from 'chatty-sdk';
import { getter, remover, setter } from "./mapio";

import * as LegacyFileSystem from 'expo-file-system/legacy';

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
    const { accessToken } = await client.getTokensAsync(getter);
    const url = `${client.config.getApi()}/files/upload`;
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

async function tryReadConfigAsync(): Promise<ChattyClientConfig | null> {
    const raw = await getter('chattyClientConfig');
    if (!raw) return null;
    try {
        let parsed = parseJsonSafely<ChattyClientConfig>(raw);

        if (!(parsed instanceof ChattyClientConfig)) // may cause always-default exception
            throw new Error(`CCC read got wrong type. read value: ${parsed}`); // hint if the returned value only "as" in typescript but prototype differend (functions lost) then may cause error on the value (not-very-same on type)

        parsed = new ChattyClientConfig(parsed.useHttps, parsed.endpoint);
        if (parsed.endpoint && (typeof parsed.useHttps == "boolean")) return parsed;
    } catch (error) {
        console.warn("Failed to parse client config from localStorage, using default. Error:", error);
        return null;
    }
    return null;

};

export let client = await (new ChattyClient(await tryReadConfigAsync() ?? DEFAULT_CLIENT_CONFIG)).initClientAsync(setter, getter, remover);

export let constructed = ConstructClient(client);

export let conversations = constructed.conversations;
export let blocks = constructed.blocks;
export let users = constructed.users;
export let auth = constructed.auth;
export let messages = constructed.messages;
export let friends = constructed.friends;

export let files = {
    ...constructed.files,
    uploadFile(file: UploadFilePayload, onUploadProgress?: (progress: number) => void) {
        return uploadWithNativeTask(file, onUploadProgress);
    },
    getFileUrl(locator: string): string {
        return client.appendAccessTokenUrl(`${client.config.getApi()}/files/${locator}`, client.cachedAccessToken ?? "");
    },
    getFileSource(locator: string) {
        return {
            uri: client.appendAccessTokenUrl(`${client.config.getApi()}/files/${locator}`, client.cachedAccessToken ?? ""),
            headers: client.appendAuthHeader(client.cachedAccessToken),
        };
    },
    async uploadAvatar(file: UploadFilePayload) {
        return uploadWithNativeTask(file);
    },
};
