import { useContext, useEffect, useMemo, useState } from "react";
import { ChatBubbleIcon, UserAddIcon, UserCircleIcon, UserListIcon } from "tdesign-icons-react";
import { conversations, friends } from "../api";
import type { Conversation } from "../types";
import { ReusableFuncs } from "../main";
import { useAuth } from "../context/AuthContext";
type DashboardState = {
    loading: boolean;
    list: Conversation[];
    pendingRequests: number;
    unreadMessages: number;
};
function StatCard({ label, value, hint }: {
    label: string;
    value: string | number;
    hint: string;
}) {
    return (<div className="rounded-2xl bg-white/80 dark:bg-slate-800/75 p-4 shadow-sm">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
        <p className="text-xs text-slate-400 mt-2">{hint}</p>
    </div>);
}
export default function Index() {
    const reuses = useContext(ReusableFuncs);
    const { user } = useAuth();
    const [state, setState] = useState<DashboardState>({
        loading: true,
        list: [],
        pendingRequests: 0,
        unreadMessages: 0,
    });
    useEffect(() => {
        (async () => {
            try {
                const [convRes, reqRes] = await Promise.all([
                    conversations.getConversations(),
                    friends.getFriendRequests('received'),
                ]);
                const list = convRes.data.data || [];
                const reqs = reqRes.data.data || [];
                const unreadMessages = list.reduce((sum, item) => sum + (item.unread_count || 0), 0);
                setState({
                    loading: false,
                    list,
                    pendingRequests: reqs.length,
                    unreadMessages,
                });
            }
            catch {
                setState((current) => ({ ...current, loading: false }));
            }
        })();
    }, []);
    const latestConversation = useMemo(() => state.list[0], [state.list]);
    const displayName = user?.display_name || user?.username || 'User';
    return (<div className="h-full overflow-y-auto">
        <div className="rounded-[2rem] bg-gradient-to-br from-[#1277d6] via-[#0ab15a] to-[#065f46] text-white p-6 shadow-xl">
            <p className="text-sm/5 text-white/80">Welcome back</p>
            <h1 className="text-3xl font-bold mt-2">{displayName}</h1>
            <p className="text-sm text-white/85 mt-3 max-w-xl">
                The web app now shares the same conversation, contacts, friend request, profile, and settings features as the RN client.
                Continue chatting from the left sidebar or use the shortcuts below.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                <button type="button" onClick={() => reuses?.goTo('/newfriend')} className="rounded-2xl bg-white/14 hover:bg-white/18 px-4 py-4 text-left backdrop-blur-sm">
                    <UserAddIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />
                    <p className="font-semibold mt-3">Add Friend</p>
                    <p className="text-sm text-white/75 mt-1">Find new people and handle friend requests</p>
                </button>
                <button type="button" onClick={() => reuses?.goTo('/settings')} className="rounded-2xl bg-white/14 hover:bg-white/18 px-4 py-4 text-left backdrop-blur-sm">
                    <UserCircleIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />
                    <p className="font-semibold mt-3">My Profile</p>
                    <p className="text-sm text-white/75 mt-1">Edit your avatar, display name, privacy, and password</p>
                </button>
                <button type="button" onClick={() => reuses?.goHome()} className="rounded-2xl bg-white/14 hover:bg-white/18 px-4 py-4 text-left backdrop-blur-sm">
                    <UserListIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />
                    <p className="font-semibold mt-3">Open Lists</p>
                    <p className="text-sm text-white/75 mt-1">Jump between messages and contacts from the sidebar</p>
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <StatCard label="Conversations" value={state.loading ? '...' : state.list.length} hint="Conversations available to this account" />
            <StatCard label="Unread Messages" value={state.loading ? '...' : state.unreadMessages} hint="Uses the same unread badge logic as the RN client" />
            <StatCard label="Friend Requests" value={state.loading ? '...' : state.pendingRequests} hint="Number of incoming requests waiting for action" />
        </div>

        <div className="rounded-[2rem] bg-white/85 dark:bg-slate-800/75 p-5 mt-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#1277d6]/10 text-[#1277d6] flex items-center justify-center">
                    <ChatBubbleIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />
                </div>
                <div>
                    <h2 className="text-xl font-semibold">Continue Chatting</h2>
                    <p className="text-sm text-slate-500">The default home page now opens the real connected experience.</p>
                </div>
            </div>

            {latestConversation ? (<button type="button" onClick={() => reuses?.setChat(String(latestConversation.peer_id))} className="mt-4 w-full rounded-2xl bg-slate-100/90 dark:bg-slate-700/70 p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-700">
                <p className="font-semibold">
                    {latestConversation.peer?.display_name || latestConversation.peer?.username || 'Latest Conversation'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                    {latestConversation.lastMessage?.is_recalled
                        ? 'The latest message was recalled'
                        : latestConversation.lastMessage?.content
                        || latestConversation.lastMessage?.file_name
                        || 'Tap to continue chatting'}
                </p>
            </button>) : (<div className="mt-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center">
                <p className="font-medium">No conversations yet</p>
                <p className="text-sm text-slate-500 mt-2">Add a friend first, then start your first conversation from the message list.</p>
                <button type="button" onClick={() => reuses?.goTo('/newfriend')} className="mt-4 px-4 py-2 rounded-xl bg-[#1277d6] text-white font-medium hover:bg-[#06a850]">
                    Add Friends
                </button>
            </div>)}
        </div>
    </div>);
}
