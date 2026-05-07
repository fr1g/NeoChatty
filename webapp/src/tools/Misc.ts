export function IsNullOrEmpty(str: string | null | undefined) {
    if (str) {
        if (str.length <= 0) return true;
        else return false;
    } else return true;
}