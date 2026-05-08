import { useContext, useEffect, useState } from "react";
import { LoginIcon, AssignmentCheckedIcon, UserAddIcon } from "tdesign-icons-react";
import { useAuth } from "../../context/AuthContext";
import { client } from "../../api";
import { ChattyClientConfig } from "chatty-sdk";
import type { DialogInfo } from "../../comps/Modal";
import { ReusableFuncs, type ModalControl } from "../../main";
import { IsNullOrEmpty } from "../../tools/Misc";

export const inputClass = "w-full block-shadow h-10 rounded-lg px-3 interactive outline-0 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:border-[#1277d6] text-sm";

export default function Auth() {

    const [page, setPage] = useState<"register" | "login">("login");
    const { login, register } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const reuses = useContext(ReusableFuncs);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('Please enter a username and password');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await login(username.trim(), password);
        }
        catch (e: any) {
            setError(`Unexpected: ${e?.response?.data?.error?.message || e?.message || 'Log In failed. Please check your username and password'}`);
        }
        finally {
            setLoading(false);
        }
    };
    const handleRegister = async () => {
        if (!username.trim()) {
            setError('Please enter a username');
            return;
        }
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username.trim())) {
            setError('Username must be 3-20 characters and can only include letters, numbers, and underscores');
            return;
        }
        if (!password) {
            setError('Please enter a password');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('The passwords do not match');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await register(username.trim(), password, displayName.trim() || undefined);
        }
        catch (e: any) {
            setError(`Unexpected: ${e?.response?.data?.error?.message || e?.message || 'Register failed. Please try again later'}`);
        }
        finally {
            setLoading(false);
        }
    };

    const handleChangeServer = (addr: string | undefined) => {
        // set localStorage
        let anotherServer;
        if (IsNullOrEmpty(addr)) anotherServer = "rus.kami.su";
        else anotherServer = addr as string;

        const useHttps = window.location.protocol.toLowerCase().includes("https");
        localStorage.setItem("chattyClientConfig", JSON.stringify(new ChattyClientConfig(useHttps, anotherServer)));

        // refresh page to get new config
        alert(`Need to refresh the app to load new config, which changes server to: ${anotherServer}`);
        window.location.reload();

    }

    const [changeServerButtonHandler, setChangeServerButtonHandler] = useState<Function | null>(null);
    const [toChangeServerAddress, setToChangeServerAddress] = useState<string | undefined>(undefined);

    const changeServerModalContent = <div className="min-w-75">
        <label className="text-sm text-slate-500 mb-1 block">Server Address. Leave blank if you wanna use default server.</label>
        <input type="text" value={toChangeServerAddress} onChange={e => {
            setToChangeServerAddress(_ => {
                console.log(_, e.target.value);
                return e.target.value;
            });
            localStorage.setItem("tochangescope", e.target.value);
        }} placeholder={`Cur: ${0}`} className={inputClass} />
    </div>

    useEffect(() => {
        if (reuses?.modalUpdate && !(changeServerButtonHandler)) {
            setChangeServerButtonHandler(_ => () => reuses!.modalUpdate!({
                info: {
                    approveCall: () => {
                        console.log(handleChangeServer);
                        handleChangeServer(localStorage.getItem('tochangescope') ?? undefined);
                    },
                    approveOpt: "Confirm",
                    title: "Change Server",
                    content: '',
                    danger: undefined
                } as DialogInfo,
                showing: true,
                customChildren: changeServerModalContent
            } as ModalControl)
            );
        }
    }, [reuses]);

    if (page === 'register')
        return <div id="register" className="space-y-3 h-full flex flex-col">
            <h1 className="text-3xl font-bold">Register</h1>
            <p className="text-sm text-slate-500">Create a new account and join Chatty</p>
            <p>Current server: {client.config.endpoint}</p>

            {error && <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-2 rounded-lg">{error}</div>}

            <div className="grow space-y-3">
                <div>
                    <label className="text-sm text-slate-500 mb-1 block">Username *</label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="3-20 letters, numbers, or underscores" className={inputClass} autoComplete="username" />
                </div>
                <div>
                    <label className="text-sm text-slate-500 mb-1 block">Display Name</label>
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Optional. Your username will be used if left blank" className={inputClass} />
                </div>
                <div>
                    <label className="text-sm text-slate-500 mb-1 block">Password *</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className={inputClass} autoComplete="new-password" />
                </div>
                <div>
                    <label className="text-sm text-slate-500 mb-1 block">Confirm Password *</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter your password again" className={inputClass} autoComplete="new-password" onKeyDown={e => e.key === 'Enter' && handleRegister()} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 w-full sm:flex sm:justify-end">
                <div onClick={() => { setPage("login"); setError(''); }} className="border-button flex gap-1 px-3! justify-center items-center cursor-pointer">
                    <LoginIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
                    <p>Log In</p>
                </div>
                <div onClick={handleRegister} className={`border-button flex gap-1 px-3! justify-center items-center cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <AssignmentCheckedIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
                    <p>{loading ? 'Creating account...' : 'Register'}</p>
                </div>
            </div>
        </div>;
    return <div id="login" className="space-y-3 h-full flex flex-col">
        <h1 className="text-3xl font-bold">Log In</h1>
        <p className="text-sm text-slate-500">Welcome back. Log In to Chatty</p>
        <p>Current server: {client.config.endpoint}</p>

        {error && <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-2 rounded-lg">{error}</div>}

        <div className="grow space-y-3">
            <div>
                <label className="text-sm text-slate-500 mb-1 block">Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" className={inputClass} autoComplete="username" />
            </div>
            <div>
                <label className="text-sm text-slate-500 mb-1 block">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className={inputClass} autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
        </div>

        <div className="flex w-full">
            <div onClick={() => changeServerButtonHandler?.()} className="border-button flex gap-1 px-3! justify-center items-center cursor-pointer">
                <p>Change Server</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 grow ?w-full sm:flex sm:justify-end">
                <div onClick={() => { setPage("register"); setError(''); }} className="border-button flex gap-1 px-3! justify-center items-center cursor-pointer">
                    <UserAddIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
                    <p>Register</p>
                </div>
                <div onClick={handleLogin} className={`border-button flex gap-1 px-3! justify-center items-center cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <AssignmentCheckedIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
                    <p>{loading ? 'Signing in...' : 'Log In'}</p>
                </div>
            </div>
        </div>
    </div>;
}
