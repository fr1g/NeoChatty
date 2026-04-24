// import { ChattyClient } from "chatty-sdk";
import { client } from ".";
import { Client } from "chatty-sdk";
import { setter, getter, remover } from "./mapio";
// import { constructed } from ".";


console.log(client)
export const setTokens = (access: string, refresh: string) => client.setTokens(access, refresh, setter);
export const getTokens = () => client.getTokens(getter);
export const clearTokens = () => client.clearTokens(remover);
export const setOnAuthExpired = (cb: Client.AuthExpiredCallback) => client.setOnAuthExpired(cb);

export const SOCKET_BASE_URL = client.config.getSocket();