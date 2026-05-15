import { getConfig } from "../config";

export function renderMOTD(fix: boolean = false): string {
    const cfg = getConfig();
    return cfg.MOTD.replace('%datetime%', new Date().toLocaleString()).replace('%info%', `\n${fix ? '        ' : ''}${cfg.INFO}`);
}

export function renderPlaceholderInfo(raw: string): string {
    return raw.replace('%datetime%', new Date().toLocaleString());
}