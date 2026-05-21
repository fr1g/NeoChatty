// import { ChattyClient } from "chatty-sdk";
import { Client } from "chatty-sdk";
import { setter, getter, remover } from "./mapio";
// import { constructed } from ".";

let client: any = null;

export function setClient(c: any) {
    client = c;
}

export function getClient() {
    if (!client) {
        throw new Error('Client not initialized. Call initializeClient() first.');
    }
    return client;
}

export const setTokens = async (access: string, refresh: string) => {
    const c = getClient();
    return await c.setTokensAsync(access, refresh, setter);
};
export const getTokens = async () => {
    const c = getClient();
    return await c.getTokensAsync(getter);
};
export const clearTokens = async () => {
    const c = getClient();
    return await c.clearTokensAsync(remover);
};

export const setOnAuthExpired = async (cb: Client.AuthExpiredCallback) => {
    const c = getClient();
    return c.setOnAuthExpired(cb);
};