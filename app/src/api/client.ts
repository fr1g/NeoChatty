// import { ChattyClient } from "chatty-sdk";
import { client } from ".";
import { Client } from "chatty-sdk";
import { setter, getter, remover } from "./mapio";
// import { constructed } from ".";



console.log(client);

export const setTokens = async (access: string, refresh: string) => await client.setTokensAsync(access, refresh, setter);
export const getTokens = async () => await client.getTokensAsync(getter);
export const clearTokens = async () => await client.clearTokensAsync(remover);

export const setOnAuthExpired = async (cb: Client.AuthExpiredCallback) => client.setOnAuthExpired(cb);

export const SOCKET_BASE_URL = client.config.getSocket();