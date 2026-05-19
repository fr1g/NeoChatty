import * as SecureStore from 'expo-secure-store';

export const getter = async (key: string) => await SecureStore.getItemAsync(key);
export const setter = async (key: string, value: string) => await SecureStore.setItemAsync(key, value);
export const remover = async (key: string) => await SecureStore.deleteItemAsync(key);