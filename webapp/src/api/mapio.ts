export const getter = (key: string) => localStorage.getItem(key);
export const setter = (key: string, value: string) => localStorage.setItem(key, value);
export const remover = (key: string) => localStorage.removeItem(key);