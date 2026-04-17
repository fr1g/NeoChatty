import { useContext, useEffect, type ReactNode } from "react";
import { LockOnIcon, LogoutIcon, UserCircleIcon, ViewListIcon, ShieldErrorIcon, Edit1Icon } from "tdesign-icons-react";
import SettingsLayout from "./SettingsLayout";
import { ReusableFuncs, type ModalControl } from "../../main";
import { useAuth } from "../../context/AuthContext";
import { files, users } from "../../api";
import type { DialogInfo } from "../../comps/Modal";
function ShortcutCard({ title, hint, onClick, icon, }: {
    title: string;
    hint: string;
    onClick: () => void;
    icon: ReactNode;
}) {
    return (<button type="button" onClick={onClick} className="rounded-2xl bg-slate-100/70 dark:bg-slate-700/70 p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm">
        <div className="flex items-center justify-between gap-3">
            <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-slate-500 mt-1">{hint}</p>
            </div>
            <div className="text-[#1277d6] shrink-0">
                {icon}
            </div>
        </div>
    </button>);
}
export default function SettingsHome() {
    const reuses = useContext(ReusableFuncs);
    const { user, updateUser, logout } = useAuth();
    useEffect(() => {
        (async () => {
            try {
                const res = await users.getMyProfile();
                const profile = res.data.data;
                if (profile) {
                    updateUser(profile);
                }
            }
            catch {
            }
        })();
    }, [updateUser]);
    const displayName = user?.display_name || user?.username || 'User';
    const avatarUrl = user?.avatar_locator ? files.getFileUrl(user.avatar_locator) : null;
    const backgroundUrl = user?.background_locator ? files.getFileUrl(user.background_locator) : null;
    const initial = displayName[0]?.toUpperCase() || '?';
    const confirmLogout = () => {
        reuses?.modalUpdate({
            info: {
                approveCall: () => logout(),
                approveOpt: 'Sign Out',
                title: 'Sign Out',
                content: 'Sign out of this account?',
                danger: 'approve',
            } as DialogInfo,
            showing: true,
        } as ModalControl);
    };
    return (<SettingsLayout title="My Profile" explain="Keeps the web profile hub aligned with the RN client.">
        <div className="space-y-4 py-2">
            <div className="rounded-3xl overflow-hidden bg-white/80 dark:bg-slate-800/75 shadow-lg">
                <div className="h-32 w-full bg-gradient-to-br from-[#1277d6] to-[#70e9a2d7] overflow-hidden">
                    {backgroundUrl && (<img src={backgroundUrl} className="w-full h-full object-cover" />)}
                </div>
                <div className="px-5 pb-5 -mt-10">
                    <div className="w-20 h-20 rounded-3xl border-4 border-white dark:border-slate-800 shadow-lg overflow-hidden bg-[#1277d6] flex items-center justify-center text-white text-3xl font-bold">
                        {avatarUrl ? (<img src={avatarUrl} className="w-full h-full object-cover" />) : (initial)}
                    </div>
                    <div className="mt-4">
                        <h2 className="text-2xl font-bold">{displayName}</h2>
                        <p className="text-sm text-slate-500 mt-1">Chatty ID: {user?.username || '-'}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ShortcutCard title="Edit Profile" hint="Update your display name, avatar, and cover image" onClick={() => reuses?.goTo('/settings/profile')} icon={<Edit1Icon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />} />
                <ShortcutCard title="Privacy Settings" hint="Control search visibility and avatar access for non-contacts" onClick={() => reuses?.goTo('/settings/privacy')} icon={<ShieldErrorIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />} />
                <ShortcutCard title="Change Password" hint="You will need to Log In again after changing it" onClick={() => reuses?.goTo('/settings/password')} icon={<LockOnIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />} />
                <ShortcutCard title="General Settings" hint="Manage the blocklist, theme, and app info" onClick={() => reuses?.goTo('/settings/general')} icon={<ViewListIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />} />
            </div>

            <div className="rounded-2xl bg-white/80 dark:bg-slate-800/75 shadow-sm p-3 space-y-2">
                <button type="button" onClick={() => reuses?.goTo('/settings/profile')} className="w-full rounded-xl px-4 py-3 bg-slate-100/80 dark:bg-slate-700/70 flex items-center justify-between text-left">
                    <span className="font-medium">View and update your profile</span>
                    <UserCircleIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />
                </button>
                <button type="button" onClick={confirmLogout} className="w-full rounded-xl px-4 py-3 bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-between text-left">
                    <span className="font-medium">Sign Out</span>
                    <LogoutIcon fillColor="transparent" strokeColor="currentColor" strokeWidth={2} />
                </button>
            </div>

            <p className="text-center text-xs text-slate-400 pt-2">Chatty v1.0.0</p>
        </div>
    </SettingsLayout>);
}
