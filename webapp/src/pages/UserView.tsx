import { useParams } from "react-router";
import { useContext, useEffect, useState } from "react";
import { ChatMessageIcon, ChevronLeftIcon, UserAddIcon, DeleteIcon, CloseCircleIcon, CheckCircleIcon } from "tdesign-icons-react";
import { ReusableFuncs, type ModalControl } from "../main";
import type { DialogInfo } from "../comps/Modal";
import { users as usersApi, friends as friendsApi, blocks as blocksApi, files } from "../api";
import type { UserProfile } from "../types";
export default function UserView() {
    const reuses = useContext(ReusableFuncs);
    const { userId } = useParams();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!userId)
            return;
        setLoading(true);
        usersApi.getUserProfile(parseInt(userId)).then(res => {
            setProfile(res.data.data as any);
        }).catch(() => {
        }).finally(() => setLoading(false));
    }, [userId]);
    const refresh = () => {
        if (!userId)
            return;
        usersApi.getUserProfile(parseInt(userId)).then(res => {
            setProfile(res.data.data as any);
        }).catch(() => { });
    };
    const handleAddFriend = async () => {
        if (!profile)
            return;
        try {
            await friendsApi.sendFriendRequest(profile.id);
            alert('Friend request sent');
            refresh();
        }
        catch (e: any) {
            alert(e?.response?.data?.error?.message || 'Failed to send');
        }
    };
    const handleDeleteFriend = () => {
        if (!profile)
            return;
        reuses?.modalUpdate({
            info: {
                approveCall: async () => {
                    try {
                        await friendsApi.deleteFriend(profile.id);
                        refresh();
                    }
                    catch {
                        alert('Failed to remove friend');
                    }
                },
                approveOpt: 'Remove',
                title: 'Remove Friend',
                content: `Remove "${profile.display_name || profile.username}" from your contacts?`,
                danger: 'approve'
            } as DialogInfo,
            showing: true,
        } as ModalControl);
    };
    const handleBlock = () => {
        if (!profile)
            return;
        reuses?.modalUpdate({
            info: {
                approveCall: async () => {
                    try {
                        await blocksApi.blockUser(profile.id);
                        refresh();
                    }
                    catch {
                        alert('Failed to block user');
                    }
                },
                approveOpt: 'Block',
                title: 'Block User',
                content: `Block "${profile.display_name || profile.username}"?`,
                danger: 'approve'
            } as DialogInfo,
            showing: true,
        } as ModalControl);
    };
    const handleUnblock = async () => {
        if (!profile)
            return;
        try {
            await blocksApi.unblockUser(profile.id);
            refresh();
        }
        catch {
            alert('Failed to unblock user');
        }
    };
    const handleChat = () => {
        if (!profile)
            return;
        reuses?.setChat(String(profile.id));
    };
    const handleAcceptRequest = async () => {
        if (!profile?.friend_request_id)
            return;
        try {
            await friendsApi.handleFriendRequest(profile.friend_request_id, 'accepted');
            refresh();
        }
        catch {
            alert('Action failed');
        }
    };
    const handleRejectRequest = async () => {
        if (!profile?.friend_request_id)
            return;
        try {
            await friendsApi.handleFriendRequest(profile.friend_request_id, 'rejected');
            refresh();
        }
        catch {
            alert('Action failed');
        }
    };
    if (loading) {
        return <div className="grid items-center justify-items-center h-full">
            <div className="animate-spin w-8 h-8 border-3 border-[#1277d6] border-t-transparent rounded-full"></div>
        </div>;
    }
    if (!profile) {
        return <div className="grid items-center justify-items-center h-full">
            <p className="text-slate-400">User not found</p>
        </div>;
    }
    const name = profile.display_name || profile.username || '?';
    const initial = name[0]?.toUpperCase();
    const avatarUrl = profile.avatar_locator ? files.getFileUrl(profile.avatar_locator) : null;
    const bgUrl = profile.background_locator ? files.getFileUrl(profile.background_locator) : null;
    return <div className="relative h-full overflow-x-hidden overflow-y-auto">

        <div onClick={() => reuses?.goHome()} className="absolute top-0 left-0 border-button flex size-fit items-center justify-items-center sm:hidden z-10">
            <ChevronLeftIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
            <div className="pr-1.5">Back</div>
        </div>


        <div className="h-32 w-full rounded-lg overflow-hidden mb-2">
            {bgUrl ? (<img src={bgUrl} className="w-full h-full object-cover" />) : (<div className="w-full h-full bg-gradient-to-br from-[#1277d6] to-[#05a050]"></div>)}
        </div>


        <div className="px-4 -mt-12 relative z-1">
            <div className="flex items-end gap-3 mb-3">
                {avatarUrl ? (<img src={avatarUrl} className="w-20 h-20 rounded-xl object-cover border-3 border-white shadow-lg" />) : (<div className="w-20 h-20 rounded-xl bg-[#1277d6] flex items-center justify-center text-white text-2xl font-bold border-3 border-white shadow-lg">
                    {initial}
                </div>)}
                <div className="pb-1">
                    <h2 className="text-xl font-bold">{name}</h2>
                    <p className="text-xs text-slate-500">@{profile.username}</p>
                </div>
            </div>


            <div className="text-sm text-slate-500 mb-3">
                {profile.relationship === 'friend' && <span className="text-[#1277d6]">✓ Already friends</span>}
                {profile.relationship === 'pending_sent' && <span className="text-amber-500">⏳ Friend request sent</span>}
                {profile.relationship === 'pending_received' && <span className="text-blue-500">📩 This person wants to add you</span>}
                {profile.relationship === 'blocked' && <span className="text-red-500">🚫 Blocked</span>}
                {profile.relationship === 'stranger' && <span className="text-slate-400">Stranger</span>}
            </div>
        </div>


        <div className="px-4 grid grid-cols-2 gap-2 mt-4">

            {profile.relationship === 'friend' && <>
                <div onClick={handleChat} className="border-button flex gap-1.5 px-3! py-2 justify-center items-center cursor-pointer col-span-2">
                    <ChatMessageIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
                    <p>Message</p>
                </div>
                <div onClick={handleDeleteFriend} className="border-button flex gap-1.5 px-3! py-2 justify-center items-center cursor-pointer text-red-500 border-red-400!">
                    <DeleteIcon className="block" />
                    <p>Remove Friend</p>
                </div>
                <div onClick={handleBlock} className="border-button flex gap-1.5 px-3! py-2 justify-center items-center cursor-pointer text-red-500 border-red-400!">
                    <CloseCircleIcon className="block" />
                    <p>Block</p>
                </div>
            </>}

            {profile.relationship === 'stranger' && <>
                <div onClick={handleAddFriend} className="border-button flex gap-1.5 px-3! py-2 justify-center items-center cursor-pointer text-[#1277d6] border-[#1277d6]!">
                    <UserAddIcon className="block" />
                    <p>Add Friend</p>
                </div>
                <div onClick={handleBlock} className="border-button flex gap-1.5 px-3! py-2 justify-center items-center cursor-pointer text-red-500 border-red-400!">
                    <CloseCircleIcon className="block" />
                    <p>Block</p>
                </div>
            </>}

            {profile.relationship === 'pending_sent' && <>
                <div className="border-button flex gap-1.5 px-3! py-2 justify-center items-center text-slate-400 cursor-not-allowed col-span-2">
                    <p>Waiting for response</p>
                </div>
            </>}

            {profile.relationship === 'pending_received' && <>
                <div onClick={handleAcceptRequest} className="border-button flex gap-1.5 px-3! py-2 justify-center items-center cursor-pointer text-[#1277d6] border-[#1277d6]!">
                    <CheckCircleIcon className="block" />
                    <p>Accept</p>
                </div>
                <div onClick={handleRejectRequest} className="border-button flex gap-1.5 px-3! py-2 justify-center items-center cursor-pointer text-slate-500 border-slate-400!">
                    <CloseCircleIcon className="block" />
                    <p>Reject</p>
                </div>
            </>}

            {profile.relationship === 'blocked' && <>
                <div onClick={handleUnblock} className="border-button flex gap-1.5 px-3! py-2 justify-center items-center cursor-pointer text-[#1277d6] border-[#1277d6]! col-span-2">
                    <CheckCircleIcon className="block" />
                    <p>Unblock</p>
                </div>
            </>}
        </div>
    </div>;
}
