import { useContext, useState, useCallback } from "react";
import { ReusableFuncs } from "../../main";
import SettingsLayout from "./SettingsLayout";
import { useAuth } from "../../context/AuthContext";
import { users as usersApi, files as filesApi } from "../../api";
export default function ProfileSettings() {
    const reuses = useContext(ReusableFuncs);
    const { user, updateUser } = useAuth();
    const [displayName, setDisplayName] = useState(user?.display_name ?? '');
    const [saving, setSaving] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [bgPreview, setBgPreview] = useState<string | null>(null);
    const [newAvatarLocator, setNewAvatarLocator] = useState<string | null>(null);
    const [newBgLocator, setNewBgLocator] = useState<string | null>(null);
    const currentAvatarUrl = avatarPreview || (user?.avatar_locator ? filesApi.getFileUrl(user.avatar_locator) : null);
    const currentBgUrl = bgPreview || (user?.background_locator ? filesApi.getFileUrl(user.background_locator) : null);
    const initial = (displayName || user?.username || '?')[0]?.toUpperCase();
    const pickImage = useCallback(async (type: 'avatar' | 'background') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file)
                return;
            const previewUrl = URL.createObjectURL(file);
            if (type === 'avatar')
                setAvatarPreview(previewUrl);
            else
                setBgPreview(previewUrl);
            try {
                const res = await filesApi.uploadFile(file);
                const locator = res.data.data?.locator;
                if (!locator)
                    throw new Error('Upload failed');
                if (type === 'avatar')
                    setNewAvatarLocator(locator);
                else
                    setNewBgLocator(locator);
            }
            catch (e: any) {
                alert('Failed to upload image: ' + (e?.message || ''));
                if (type === 'avatar')
                    setAvatarPreview(null);
                else
                    setBgPreview(null);
            }
        };
        input.click();
    }, []);
    const save = async () => {
        if (!displayName.trim()) {
            alert('Display name cannot be empty');
            return;
        }
        setSaving(true);
        try {
            const data: any = {};
            if (displayName !== user?.display_name)
                data.display_name = displayName.trim();
            if (newAvatarLocator)
                data.avatar_locator = newAvatarLocator;
            if (newBgLocator)
                data.background_locator = newBgLocator;
            const res = await usersApi.updateProfile(data);
            const updated = res.data.data;
            if (updated)
                updateUser(updated);
            alert('Profile updated');
            reuses?.goHome();
        }
        catch {
            alert('Failed to save');
        }
        finally {
            setSaving(false);
        }
    };
    return <SettingsLayout title="Edit Profile" explain="Update your display name, avatar, and background image.">
        <div className="space-y-4 py-2">

            <div>
                <label className="text-sm text-slate-500 mb-1 block">Display Name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Enter a display name..." className="w-full h-10 rounded-lg px-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 outline-0 focus:border-[#1277d6]" />
            </div>


            <div>
                <label className="text-sm text-slate-500 mb-2 block">Avatar</label>
                <div className="flex items-center gap-3">
                    {currentAvatarUrl ? (<img src={currentAvatarUrl} className="w-16 h-16 rounded-xl object-cover border border-slate-300" />) : (<div className="w-16 h-16 rounded-xl bg-[#1277d6] flex items-center justify-center text-white text-xl font-bold">
                        {initial}
                    </div>)}
                    <button onClick={() => pickImage('avatar')} className="px-4 py-2 rounded-lg bg-[#1277d6]/10 text-[#1277d6] text-sm font-medium hover:bg-[#1277d6]/20">
                        Change Avatar
                    </button>
                </div>
            </div>


            <div>
                <label className="text-sm text-slate-500 mb-2 block">Profile Background</label>
                <div className="flex items-center gap-3">
                    {currentBgUrl ? (<img src={currentBgUrl} className="w-28 h-16 rounded-lg object-cover border border-slate-300" />) : (<div className="w-28 h-16 rounded-lg bg-gradient-to-br from-[#1277d6] to-[#05a050] flex items-center justify-center text-white text-sm">
                        Default
                    </div>)}
                    <button onClick={() => pickImage('background')} className="px-4 py-2 rounded-lg bg-[#1277d6]/10 text-[#1277d6] text-sm font-medium hover:bg-[#1277d6]/20">
                        Change Background
                    </button>
                </div>
            </div>


            <button onClick={save} disabled={saving} className="w-full h-11 rounded-lg bg-[#1277d6] text-white font-semibold text-base hover:bg-[#06a850] disabled:opacity-50 mt-2">
                {saving ? 'Saving...' : 'Save All Changes'}
            </button>
        </div>
    </SettingsLayout>;
}
