import { Input } from "@headlessui/react";
import NavList, { type NavListItem } from "../../comps/NavList";
import { SearchIcon, UserAddIcon, UserListIcon } from "tdesign-icons-react";
import { useContext, useEffect, useState, useCallback } from "react";
import { AvataredNavListItemFactory } from "../../comps/AvataredListItem";
import { ReusableFuncs } from "../../main";
import { conversations, files } from "../../api";
import * as socketService from "../../services/socket";
import type { Conversation } from "../../types";


export default function RecentChats({ openUserSearch, gotoContacts }: {
    openUserSearch: Function;
    gotoContacts: Function;
}) {
    const reuses = useContext(ReusableFuncs);
    const [convList, setConvList] = useState<Conversation[]>([]);
    const [items, setItems] = useState<NavListItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchText, setSearchText] = useState('');
    const loadConversations = useCallback(async () => {
        try {
            const res = await conversations.getConversations();
            setConvList(res.data.data || []);
        }
        catch (e) {
        }
    }, []);
    useEffect(() => {
        setInterval(() => {
            loadConversations();
        }, 1000);
    }, [loadConversations]);
    useEffect(() => {
        const offMsg = socketService.onMessage(() => loadConversations());
        const offRecalled = socketService.onMessageRecalled(() => loadConversations());
        const offReadAck = socketService.onMessageReadAck(() => loadConversations());
        const offReq = socketService.onFriendRequest(() => loadConversations());
        const offAccepted = socketService.onFriendAccepted(() => loadConversations());
        socketService.setOnReconnect(() => loadConversations());
        return () => {
            offMsg();
            offRecalled();
            offReadAck();
            offReq();
            offAccepted();
        };
    }, [loadConversations]);
    const formatTime = (ts: string) => {
        const date = new Date(ts);
        const now = new Date();
        const isToday = date.getFullYear() === now.getFullYear()
            && date.getMonth() === now.getMonth()
            && date.getDate() === now.getDate();
        if (isToday) {
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };
    const getPreview = (item: Conversation): string => {
        const msg = item.lastMessage;
        if (!msg)
            return '';
        if (msg.is_recalled)
            return 'Message recalled';
        switch (msg.type) {
            case 'image':
                return '[Image]';
            case 'video':
                return '[Video]';
            case 'file':
                return `[File] ${msg.file_name || ''}`.trim();
            default:
                return msg.content || '';
        }
    };
    useEffect(() => {
        if (!reuses)
            return;
        const keyword = searchText.trim().toLowerCase();
        const filtered = keyword
            ? convList.filter((item) => {
                const name = item.peer?.display_name || item.peer?.username || '';
                return name.toLowerCase().includes(keyword);
            })
            : convList;
        const navItems = filtered.map((item) => {
            const peer = item.peer;
            const peerName = peer?.display_name || peer?.username || '?';
            const preview = getPreview(item);
            const time = item.lastMessage ? formatTime(item.lastMessage.created_at) : '';
            const avatarUrl = peer?.avatar_locator ? files.getFileUrl(peer.avatar_locator) : undefined;
            const badge = item.unread_count > 0 ? (<span className="bg-red-500 text-white text-[11px] font-semibold rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                {item.unread_count > 99 ? '99+' : item.unread_count}
            </span>) : undefined;
            const additionalElement = (<div className="flex flex-col items-end gap-1 shrink-0 ml-auto">
                {time && <span className="text-xs text-slate-400">{time}</span>}
                {badge}
            </div>);
            return AvataredNavListItemFactory({
                name: peerName,
                jumper: () => reuses.setChat(String(item.peer_id)),
                customNode: additionalElement,
            } as NavListItem, preview, avatarUrl);
        });
        setItems(navItems);
    }, [convList, reuses, searchText]);
    return <div className="max-h-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold my-1">Messages</h3>
            <button type="button" onClick={() => openUserSearch()} className="border-button flex items-center gap-1">
                <UserAddIcon fillColor='transparent' size='medium' className='block' strokeColor='currentColor' strokeWidth={2} />
                <span className="text-sm">Find People</span>
            </button>
        </div>

        <div className="relative mb-3">
            <div className={`grid items-center border-button border-0! z-10 absolute left-0.5 top-0 bottom-0 ${searching ? 'opacity-15!' : 'opacity-100!'}`}>
                <SearchIcon fillColor='transparent' size='large' strokeColor='currentColor' strokeWidth={2} />
            </div>
            <Input placeholder={searching ? 'Search chats...' : ''} value={searchText} onChange={(event: any) => setSearchText(event.target.value)} onFocus={() => setSearching(true)} onBlur={() => setSearching(false)} className='w-full block-shadow h-8 rounded-lg px-1 pl-8 interactive outline-0' />
            <div onClick={() => gotoContacts()} className={`items-center hidden border-button z-10 absolute right-0 top-0 bottom-0 sm:grid ${searching ? 'opacity-15! hover:opacity-50!' : 'opacity-100!'}`}>
                <UserListIcon fillColor='transparent' size='large' className='block' strokeColor='currentColor' strokeWidth={2} />
            </div>
        </div>

        {items.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <p className="text-slate-400 text-sm">{searchText ? 'No matching chats found' : 'No messages yet. Start a chat with a friend.'}</p>
            {!searchText && (<button type="button" onClick={() => openUserSearch()} className="mt-4 px-4 py-2 rounded-xl bg-[#1277d6] text-white text-sm font-medium hover:bg-[#06a850]">
                Add Friends
            </button>)}
        </div>) : (<NavList items={items} tight hintBottom />)}
    </div>;
}
