import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeftIcon, SearchIcon, CheckIcon, CloseIcon, UserAddIcon } from "tdesign-icons-react";
import { ReusableFuncs } from "../main";
import { users as usersApi, friends as friendsApi, files } from "../api/index";
import type { FriendRequest, UserProfile } from "chatty-sdk";
const PAGE_SIZE = 20;

export default function NewFriend() {
    const reuses = useContext(ReusableFuncs);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [searching, setSearching] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searched, setSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [receivedReqs, setReceivedReqs] = useState<FriendRequest[]>([]);
    const [sentReqs, setSentReqs] = useState<FriendRequest[]>([]);
    const [loadingReqs, setLoadingReqs] = useState(true);
    const loadRequests = useCallback(async () => {
        setLoadingReqs(true);
        try {
            const [recv, sent] = await Promise.all([
                friendsApi.getFriendRequests('received'),
                friendsApi.getFriendRequests('sent'),
            ]);
            setReceivedReqs(recv.data.data || []);
            setSentReqs(sent.data.data || []);
        }
        catch (e) {
        }
        finally {
            setLoadingReqs(false);
        }
    }, []);
    useEffect(() => {
        loadRequests();
    }, [loadRequests]);
    const runSearch = useCallback(async (keyword: string, nextPage = 1, append = false) => {
        const value = keyword.trim();
        if (!value) {
            setSearchResults([]);
            setSearched(false);
            setPage(1);
            setTotal(0);
            return;
        }
        if (append) {
            setLoadingMore(true);
        }
        else {
            setSearching(true);
        }
        setSearched(true);
        try {
            const res = await usersApi.searchUsers(value, nextPage, PAGE_SIZE);
            const data = res.data.data;
            const users = data?.users || [];
            setSearchResults(prev => append ? [...prev, ...users] : users);
            setPage(nextPage);
            setTotal(data?.total || 0);
        }
        catch {
            alert(append ? 'Failed to load more results' : 'Search failed');
        }
        finally {
            setSearching(false);
            setLoadingMore(false);
        }
    }, []);
    useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            runSearch(query);
        }, 300);
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [query, runSearch]);
    const loadMore = useCallback(async () => {
        if (loadingMore || searchResults.length >= total) {
            return;
        }
        await runSearch(query, page + 1, true);
    }, [loadingMore, page, query, runSearch, searchResults.length, total]);
    const refreshSearch = useCallback(async () => {
        if (!query.trim()) {
            return;
        }
        await runSearch(query, 1, false);
    }, [query, runSearch]);
    const sendRequest = async (userId: number) => {
        try {
            await friendsApi.sendFriendRequest(userId);
            alert('Friend request sent');
            await Promise.all([loadRequests(), refreshSearch()]);
        }
        catch (e: any) {
            alert(e?.response?.data?.error?.message || 'Failed to send friend request');
        }
    };
    const handleRequest = async (id: number, status: 'accepted' | 'rejected') => {
        try {
            await friendsApi.handleFriendRequest(id, status);
            await Promise.all([loadRequests(), refreshSearch()]);
        }
        catch {
            alert('Action failed');
        }
    };
    const hasMore = searchResults.length < total;
    const formatRequestTime = (request: FriendRequest) => {
        const rawValue = (request as any).created_at ?? (request as any).createdAt;
        const date = rawValue ? new Date(rawValue) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return 'Just now';
        }
        return date.toLocaleString('en-US');
    };
    return <div className="h-full w-full p-1.5 overflow-hidden flex flex-col gap-3">
        <div className="flex gap-3 items-center">
            <div onClick={() => reuses?.goHome()} className="border-button grid size-full items-center justify-items-center sm:hidden aspect-square w-fit">
                <ChevronLeftIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
            </div>
            <div>
                <h1 className="font-semibold text-2xl">New Friends</h1>
            </div>
        </div>
        <p className="text-sm text-slate-500 mt-1">This page combines the RN flows for Add Friend and New Friends.</p>

        <div className="flex gap-1.5">
            <div className="relative grow">
                <div className="grid items-center absolute left-2 top-0 bottom-0 opacity-50">
                    <SearchIcon fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
                </div>
                <input type="text" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && runSearch(query)} placeholder="Search by username or display name..." className="w-full h-9 rounded-lg pl-8 pr-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 outline-0 focus:border-[#1277d6] text-sm" />
            </div>
            <button onClick={() => runSearch(query)} disabled={searching} className="px-4 h-9 rounded-lg bg-[#1277d6] text-white! text-sm font-medium hover:bg-[#3596f1dd] disabled:opacity-50 shrink-0">
                {searching ? 'Searching...' : 'Search'}
            </button>
        </div>

        <div className="overflow-y-auto grow flex flex-col gap-4 pr-1">
            <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">Search Results</h3>
                {searching && searchResults.length === 0 ? (<p className="text-sm text-slate-400 text-center py-4">Searching...</p>) : searchResults.length === 0 ? (<p className="text-sm text-slate-400 text-center py-4">
                    {searched ? 'No matching users found' : 'Enter a Chatty ID or display name to search'}
                </p>) : (<div className="space-y-1">
                    {searchResults.map(user => {
                        const avatarUrl = user.avatar_locator ? files.getFileUrl(user.avatar_locator) : null;
                        const name = user.display_name || user.username || '?';
                        const initial = name[0]?.toUpperCase();
                        return (<div key={user.id} role="button" tabIndex={0} onClick={() => reuses?.setUserView(String(user.id))} onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                reuses?.setUserView(String(user.id));
                            }
                        }} className="w-full flex items-center gap-2 p-2 rounded-lg bg-slate-100/50 dark:bg-slate-600/50 text-left hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                            {avatarUrl ? (<img src={avatarUrl} className="w-10 h-10 rounded-lg object-cover" />) : (<div className="w-10 h-10 rounded-lg bg-[#1277d6] flex items-center justify-center text-white font-bold">
                                {initial}
                            </div>)}
                            <div className="grow min-w-0">
                                <p className="font-medium truncate">{name}</p>
                                <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                            </div>

                            {user.relationship === 'friend' ? (<span className="text-xs text-slate-400 px-2">Already friends</span>) : user.relationship === 'pending_sent' ? (<span className="text-xs text-slate-400 px-2">Sent</span>) : user.relationship === 'pending_received' ? (<span className="text-xs text-blue-500 px-2">Pending</span>) : (<button type="button" onClick={(event) => {
                                event.stopPropagation();
                                sendRequest(user.id);
                            }} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-[#1277d6] text-white! hover:bg-[#3596f1dd]">
                                <UserAddIcon size="14px" /> Add Friend
                            </button>)}
                        </div>);
                    })}
                    {hasMore && (<button type="button" onClick={loadMore} disabled={loadingMore} className="w-full mt-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-500 py-2 text-sm text-[#1277d6] disabled:opacity-50">
                        {loadingMore ? 'Loading...' : 'Load more'}
                    </button>)}
                </div>)}
            </div>

            <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">Received Requests</h3>
                {loadingReqs ? (<p className="text-sm text-slate-400 text-center py-4">Loading...</p>) : receivedReqs.length === 0 ? (<p className="text-sm text-slate-400 text-center py-4">No incoming friend requests</p>) : (<div className="space-y-1">
                    {receivedReqs.map(req => {
                        const fromUser = req.fromUser;
                        const name = fromUser?.display_name || fromUser?.username || '?';
                        const avatarUrl = fromUser?.avatar_locator ? files.getFileUrl(fromUser.avatar_locator) : null;
                        const initial = name[0]?.toUpperCase();
                        return (<div key={req.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-100/50 dark:bg-slate-600/50">
                            {avatarUrl ? (<img src={avatarUrl} className="w-10 h-10 rounded-lg object-cover" />) : (<div className="w-10 h-10 rounded-lg bg-slate-400 flex items-center justify-center text-white font-bold">
                                {initial}
                            </div>)}
                            <div className="grow min-w-0">
                                <p className="font-medium truncate">{name}</p>
                                <p className="text-xs text-slate-500">{formatRequestTime(req)}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleRequest(req.id, 'accepted')} className="p-1.5 rounded-lg bg-[#1277d6] text-white! hover:bg-[#3596f1dd]">
                                    <CheckIcon size="16px" />
                                </button>
                                <button onClick={() => handleRequest(req.id, 'rejected')} className="p-1.5 rounded-lg bg-red-400 text-white hover:bg-red-500">
                                    <CloseIcon size="16px" />
                                </button>
                            </div>
                        </div>);
                    })}
                </div>)}
            </div>

            <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">Sent Requests</h3>
                {sentReqs.length === 0 ? (<p className="text-sm text-slate-400 text-center py-4">No outgoing friend requests</p>) : (<div className="space-y-1">
                    {sentReqs.map(req => {
                        const toUser = req.toUser;
                        const name = toUser?.display_name || toUser?.username || '?';
                        const avatarUrl = toUser?.avatar_locator ? files.getFileUrl(toUser.avatar_locator) : null;
                        const initial = name[0]?.toUpperCase();
                        return (<div key={req.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-100/50 dark:bg-slate-600/50">
                            {avatarUrl ? (<img src={avatarUrl} className="w-10 h-10 rounded-lg object-cover" />) : (<div className="w-10 h-10 rounded-lg bg-slate-400 flex items-center justify-center text-white font-bold">
                                {initial}
                            </div>)}
                            <div className="grow min-w-0">
                                <p className="font-medium truncate">{name}</p>
                                <p className="text-xs text-slate-500">@{toUser?.username}</p>
                            </div>
                            <span className="text-xs px-2 text-slate-400">Pending</span>
                        </div>);
                    })}
                </div>)}
            </div>
        </div>
    </div>;
}
