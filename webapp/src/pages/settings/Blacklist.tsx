import { useState, useEffect, useCallback } from "react";
import SettingsLayout from "./SettingsLayout";
import { blocks as blocksApi, files } from "../../api";
import type { User } from "../../types";
export default function Blacklist() {
    const [list, setList] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const loadBlocks = useCallback(async () => {
        try {
            const res = await blocksApi.getBlocks();
            const blockList = res.data.data ?? [];
            setList(blockList.map((b: any) => b.blockedUser ?? b));
        }
        catch {
            alert('Failed to load blocklist');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { loadBlocks(); }, [loadBlocks]);
    const confirmUnblock = async (userId: number, name: string) => {
        if (!confirm(`Remove "${name}" from the blocklist?`))
            return;
        try {
            await blocksApi.unblockUser(userId);
            setList(prev => prev.filter(u => u.id !== userId));
        }
        catch {
            alert('Failed to unblock user');
        }
    };
    if (loading) {
        return <SettingsLayout title="Blocklist" explain="Manage blocked users.">
            <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[#1277d6] border-t-transparent rounded-full"></div>
            </div>
        </SettingsLayout>;
    }
    return <SettingsLayout title="Blocklist" explain="Manage blocked users.">
        {list.length === 0 ? (<p className="text-slate-400 text-center py-8">Your blocklist is empty</p>) : (<div className="space-y-1 py-2">
            {list.map(user => {
                const name = user.display_name || user.username || '?';
                const avatarUrl = user.avatar_locator ? files.getFileUrl(user.avatar_locator) : null;
                const initial = name[0]?.toUpperCase();
                return (<div key={user.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-100/50 dark:bg-slate-600/50">
                    {avatarUrl ? (<img src={avatarUrl} className="w-10 h-10 rounded-lg object-cover" />) : (<div className="w-10 h-10 rounded-lg bg-slate-400 flex items-center justify-center text-white font-bold">
                        {initial}
                    </div>)}
                    <span className="grow font-medium">{name}</span>
                    <button onClick={() => confirmUnblock(user.id, name)} className="text-sm px-3 py-1.5 rounded-lg border border-[#1277d6] text-[#1277d6] hover:bg-[#1277d6]/10">
                        Unblock
                    </button>
                </div>);
            })}
        </div>)}
    </SettingsLayout>;
}
