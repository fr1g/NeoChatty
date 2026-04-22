import sequelize from '../config/database';
const TABLES = [
    'users',
    'privacy_settings',
    'friend_requests',
    'contacts',
    'blocks',
    'messages',
    'files',
    'conversations',
];
function normalizeIndexFields(index: any): string {
    const fields = Array.isArray(index.fields)
        ? index.fields
            .map((field: any) => field.attribute || field.name || field)
            .filter(Boolean)
        : [];
    return fields.join(',');
}
function isNumericSuffixIndex(name: string): boolean {
    return /_\d+$/.test(name);
}
export async function cleanupDuplicateIndexes() {
    const queryInterface = sequelize.getQueryInterface();
    for (const table of TABLES) {
        let indexes: any[] = [];
        try {
            const foundIndexes = await queryInterface.showIndex(table as any);
            indexes = Array.isArray(foundIndexes) ? foundIndexes : [];
        }
        catch (err: any) {
            if (err?.name === 'SequelizeDatabaseError' &&
                typeof err?.original?.sqlMessage === 'string' &&
                err.original.sqlMessage.includes("doesn't exist")) {
                continue;
            }
            throw err;
        }
        const groupedIndexes = new Map<string, any[]>();
        for (const index of indexes) {
            if (!index.name || index.name === 'PRIMARY') {
                continue;
            }
            const fields = normalizeIndexFields(index);
            if (!fields) {
                continue;
            }
            const signature = `${index.unique ? 'unique' : 'normal'}:${fields}`;
            const group = groupedIndexes.get(signature) ?? [];
            group.push(index);
            groupedIndexes.set(signature, group);
        }
        for (const group of groupedIndexes.values()) {
            if (group.length < 2) {
                continue;
            }
            const sortedGroup = [...group].sort((left, right) => {
                const leftIsSuffix = isNumericSuffixIndex(left.name);
                const rightIsSuffix = isNumericSuffixIndex(right.name);
                if (leftIsSuffix !== rightIsSuffix) {
                    return leftIsSuffix ? 1 : -1;
                }
                return left.name.localeCompare(right.name, 'en');
            });
            const [, ...duplicates] = sortedGroup;
            for (const duplicate of duplicates) {
                if (!isNumericSuffixIndex(duplicate.name)) {
                    continue;
                }
                await queryInterface.removeIndex(table, duplicate.name);
            }
        }
    }
}
