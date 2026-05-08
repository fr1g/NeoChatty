import { useState } from "react";
import SettingsLayout from "./SettingsLayout";
import { auth } from "../../api";
import { useAuth } from "../../context/AuthContext";
export default function ChangePassword() {
    const { logout } = useAuth();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const handleChange = async () => {
        if (!oldPassword) {
            alert('Please enter your current password');
            return;
        }
        if (newPassword.length < 6) {
            alert('New PasswordAt least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('The new passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await auth.changePassword(oldPassword, newPassword);
            alert('Password changed. Please Log In again');
            logout();
        }
        catch {
            alert('Failed to change password. Please check your current password.');
        }
        finally {
            setLoading(false);
        }
    };
    const inputClass = "w-full h-10 rounded-lg px-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 outline-0 focus:border-[#1277d6] text-sm";
    return <SettingsLayout title="Change Password" explain="You will need to Log In again after changing your password.">
        <div className="space-y-3 py-2">
            <div>
                <label className="text-sm text-slate-500 mb-1 block">Current Password</label>
                <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Please enter your current password" className={inputClass} />
            </div>
            <div>
                <label className="text-sm text-slate-500 mb-1 block">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" className={inputClass} />
            </div>
            <div>
                <label className="text-sm text-slate-500 mb-1 block">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter the new password again" className={inputClass} onKeyDown={e => e.key === 'Enter' && handleChange()} />
            </div>
            <button onClick={handleChange} disabled={loading} className="w-full h-11 rounded-lg bg-[#1277d6] text-white! font-semibold hover:bg-[#06a850] disabled:opacity-50 mt-2">
                {loading ? 'Submitting...' : 'Change Password'}
            </button>
        </div>
    </SettingsLayout>;
}
