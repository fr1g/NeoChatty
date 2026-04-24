import { ArrowLeftIcon, SearchIcon, ShieldErrorIcon, UserAddIcon, UserListIcon } from "tdesign-icons-react";
import { Input } from "@headlessui/react";
import { useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { ReusableFuncs } from "../../main";
import { friends as friendsApi, files } from "../../api";
import { ChattySocket as socketService } from 'chatty-sdk';
import type { User } from "chatty-sdk";
function ActionCard({ title, onClick, badge, icon, }: {
    title: string;
    onClick: () => void;
    badge?: number;
    icon: ReactNode;
}) {
    return (<button type="button" onClick={onClick} className="relative rounded-2xl bg-slate-100/65 dark:bg-slate-700/70 px-3 py-3 text-center shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700">
        {typeof badge === 'number' && badge > 0 && (<span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
            {badge > 99 ? '99+' : badge}
        </span>)}
        <div className="text-[#1277d6] flex justify-center">{icon}</div>
        <p className="font-medium text-sm leading-tight mt-2">{title}</p>
    </button>);
}
export default function Contacts({ navGoBack }: {
    navGoBack: Function;
}) {
    const reuses = useContext(ReusableFuncs);
    const [searching, setSearching] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [friendList, setFriendList] = useState<User[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const loadFriends = useCallback(async () => {
        try {
            const res = await friendsApi.getFriends();
            setFriendList(res.data.data || []);
        }
        catch (e) {
        }
    }, []);
    const checkNewRequests = useCallback(async () => {
        try {
            const res = await friendsApi.getFriendRequests('received');
            const reqs = res.data.data || [];
            setPendingCount(reqs.length);
        }
        catch {
        }
    }, []);
    useEffect(() => {
        loadFriends();
        checkNewRequests();
    }, [loadFriends, checkNewRequests]);
    useEffect(() => {
        const offOnline = socketService.onUserOnline((data: {
            userId: number;
        }) => {
            setFriendList(prev => prev.map(friend => friend.id === data.userId ? { ...friend, is_online: true } : friend));
        });
        const offOffline = socketService.onUserOffline((data: {
            userId: number;
        }) => {
            setFriendList(prev => prev.map(friend => friend.id === data.userId ? { ...friend, is_online: false } : friend));
        });
        const offReq = socketService.onFriendRequest(() => checkNewRequests());
        const offAccepted = socketService.onFriendAccepted(() => {
            loadFriends();
            checkNewRequests();
        });
        return () => {
            offOnline();
            offOffline();
            offReq();
            offAccepted();
        };
    }, [checkNewRequests, loadFriends]);
    const keyword = searchText.trim().toLowerCase();
    const filtered = keyword
        ? friendList.filter(friend => (friend.display_name || '').toLowerCase().includes(keyword)
            || (friend.username || '').toLowerCase().includes(keyword))
        : friendList;
    return <div className="gap-3 max-h-full flex flex-col">
        <div className="hidden sm:flex gap-3 items-center block-shadow border-button" onClick={() => navGoBack()}>
            <ArrowLeftIcon className="block ml-1" />
            <p>Back</p>
        </div>

        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-xl font-semibold">Contacts</h3>
            </div>
            <span className="text-xs text-slate-400">{friendList.length} friends</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
            <ActionCard title="Add Friend" onClick={() => reuses?.goTo("/newfriend")} icon={<UserAddIcon fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />} />
            <ActionCard title="Requests" badge={pendingCount} onClick={() => reuses?.goTo("/newfriend")} icon={<UserListIcon fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />} />
            <ActionCard title="Blocklist" onClick={() => reuses?.goTo("/settings/blacklist")} icon={<ShieldErrorIcon fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />} />
        </div>

        <div className="relative">
            <div className={`grid items-center border-button border-0! z-10 absolute left-0.5 top-0 bottom-0 ${searching ? 'opacity-15!' : 'opacity-100!'}`}>
                <SearchIcon fillColor='transparent' size='large' strokeColor='currentColor' strokeWidth={2} />
            </div>
            <Input placeholder={searching ? 'Search contacts...' : ''} value={searchText} onChange={(event: any) => setSearchText(event.target.value)} onFocus={() => setSearching(true)} onBlur={() => setSearching(false)} className='w-full block-shadow h-8 rounded-lg px-1 interactive outline-0' />
        </div>

        <div className="overflow-y-auto grow space-y-2 pb-6">
            {filtered.length === 0 ? (<div className="flex-1 flex items-center justify-center py-8">
                <p className="text-slate-400 text-sm">{searchText ? 'No matching contacts found' : 'No contacts yet. Add one to get started.'}</p>
            </div>) : (filtered.map((friend) => {
                const name = friend.display_name || friend.username || '?';
                const avatarUrl = friend.avatar_locator ? files.getFileUrl(friend.avatar_locator) : null;
                const initial = name[0]?.toUpperCase() || '?';
                return (<div key={friend.id} role="button" tabIndex={0} onClick={() => reuses?.setChat(String(friend.id))} onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        reuses?.setChat(String(friend.id));
                    }
                }} className="w-full rounded-2xl bg-slate-100/60 dark:bg-slate-700/60 px-3 py-3 text-left flex items-center gap-3 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                    <div className="relative shrink-0">
                        {avatarUrl ? (<img src={avatarUrl} className="w-11 h-11 rounded-2xl object-cover" />) : (<div className="w-11 h-11 rounded-2xl bg-[#1277d6] flex items-center justify-center text-white font-bold">
                            {initial}
                        </div>)}
                        <span className={`absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-700 ${friend.is_online ? 'bg-[#1277d6]' : 'bg-slate-300'}`}></span>
                    </div>

                    <div className="grow min-w-0">
                        <p className="font-semibold truncate">{name}</p>
                        <p className="text-sm text-slate-500 truncate mt-1">
                            {friend.is_online ? 'Online now' : `@${friend.username}`}
                        </p>
                    </div>

                    <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        reuses?.setUserView(String(friend.id));
                    }} className="shrink-0 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-500 text-sm hover:bg-slate-200/70 dark:hover:bg-slate-600/70">
                        Profile
                    </button>
                </div>);
            }))}
        </div>
    </div>;
}
