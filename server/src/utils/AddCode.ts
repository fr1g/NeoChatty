import GlobalScope from "../global";

export default class AddCode {
    code: number;
    ofUser: string;
    expireAt: number;

    isValid: boolean = true;

    constructor(userId: string) {
        this.ofUser = userId;
        this.code = Math.floor(10000000 + Math.random() * 90000000);
        this.expireAt = Date.now() + 30 * 1000 + 100;
    }

    genCode() {
        this.code = Math.floor(10000000 + Math.random() * 90000000);
    }

    consumeSelf() {
        this.isValid = false;
        GlobalScope.GeneratedCodeNumbers.delete(this.code);
        return this;
    }

    getKey() {
        return `${this.ofUser}`;
    }

    static getCodeInfo(code: number): AddCode | null {
        for (const entry of GlobalScope.AddCodePool.values()) {
            if (entry.code === code)
                return entry;
        }
        return null;
    }

    static isValid(ofUser: string, code: number): boolean { // need to ensure the passed in user id is valid
        const find = GlobalScope.AddCodePool.get(ofUser);
        return (find?.isValid && find.expireAt > Date.now() && find.code === code) ?? false;
    }

    static createCode(forUser: string, pushAlso: boolean = true): AddCode {
        const newCode = new AddCode(forUser);

        while (GlobalScope.GeneratedCodeNumbers.has(newCode.code))
            newCode.genCode();

        const oldEntry = GlobalScope.AddCodePool.get(forUser);
        if (oldEntry && oldEntry.isValid)
            GlobalScope.GeneratedCodeNumbers.delete(oldEntry.code);
        // LLM CHECK:
        // should remove old first and then push new.

        if (pushAlso) {
            GlobalScope.AddCodePool.set(forUser, newCode);
            GlobalScope.GeneratedCodeNumbers.add(newCode.code);
        }

        return newCode;
    }

    static consume(ofUser: string, code: number) {
        const entry = GlobalScope.AddCodePool.get(ofUser);
        if (!entry || entry.code !== code || !entry.isValid || entry.expireAt <= Date.now())
            return false;
        if (entry.code === code)
            entry.consumeSelf();
        GlobalScope.AddCodePool.set(ofUser, entry);
        return true;
    }

    static cleanup() {
        const now = Date.now();
        for (const [key, entry] of GlobalScope.AddCodePool.entries()) {
            if (!entry.isValid || entry.expireAt <= now) {
                GlobalScope.AddCodePool.delete(key);
                GlobalScope.GeneratedCodeNumbers.delete(entry.code);
            }
        }
    }
}