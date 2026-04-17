import { useState, useEffect } from "react";
import SettingsLayout from "./SettingsLayout";
import { users as usersApi } from "../../api";
import type { PrivacySettings as PrivacyState } from "../../types";
export default function PrivacySettings() {
    const [settings, setSettings] = useState<PrivacyState | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            try {
                const res = await usersApi.getMyPrivacy();
                setSettings(res.data.data as any);
            }
            catch {
                alert('Failed to load privacy settings');
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    const toggle = async (key: keyof PrivacyState) => {
        if (!settings)
            return;
        const newVal = !settings[key];
        const prev = { ...settings };
        setSettings({ ...settings, [key]: newVal });
        try {
            await usersApi.updatePrivacy({ [key]: newVal });
        }
        catch {
            setSettings(prev);
            alert('Update failed');
        }
    };
    const items: {
        key: keyof PrivacyState;
        label: string;
        desc: string;
    }[] = [
            { key: 'searchable_by_username', label: 'Allow search by username', desc: 'Other users can find you by your username' },
            { key: 'searchable_by_display_name', label: 'Allow search by display name', desc: 'Other users can find you by your display name' },
            { key: 'show_avatar_to_strangers', label: 'Show avatar to non-contacts', desc: 'People who are not your contacts can view your avatar' },
        ];
    if (loading) {
        return <SettingsLayout title="Privacy" explain="Manage your visibility and search preferences.">
            <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[#1277d6] border-t-transparent rounded-full"></div>
            </div>
        </SettingsLayout>;
    }
    if (!settings) {
        return <SettingsLayout title="Privacy">
            <p className="text-slate-400 text-center py-8">Failed to load</p>
        </SettingsLayout>;
    }
    return <SettingsLayout title="Privacy" explain="Manage your visibility and search preferences.">
        <div className="space-y-1 py-2">
            {items.map((item) => (<div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-100/50 dark:bg-slate-600/50 cursor-pointer" onClick={() => toggle(item.key)}>
                <div className="grow pr-3">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${settings[item.key] ? 'bg-[#1277d6]' : 'bg-slate-300 dark:bg-slate-500'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings[item.key] ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
                </div>
            </div>))}
        </div>
    </SettingsLayout>;
}
