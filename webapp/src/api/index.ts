import { ConstructClient } from "chatty-sdk";

import { ChattyClient, ChattyClientConfig, DEFAULT_CLIENT_CONFIG } from 'chatty-sdk';
import { getter, remover, setter } from "./mapio";

function tryReadConfig(): ChattyClientConfig | null {
    const raw = localStorage.getItem('chattyClientConfig');
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as ChattyClientConfig;
        if (parsed.endpoint && parsed.useHttps) return parsed;
    } catch (error) {
        console.warn("Failed to parse client config from localStorage, using default. Error:", error);
        return null;
    }
    return null;

};

export let client = (new ChattyClient(tryReadConfig() ?? DEFAULT_CLIENT_CONFIG)).initClient(setter, getter, remover);

export let constructed = ConstructClient(client);

export let conversations = constructed.conversations;
export let files = constructed.files;
export let blocks = constructed.blocks;
export let users = constructed.users;
export let auth = constructed.auth;
export let messages = constructed.messages;
export let friends = constructed.friends;
