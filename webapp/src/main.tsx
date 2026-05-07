import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Index from './pages';
import { Conversation } from './pages/conversation';
import { ThemeHelper, useThemeDetector } from './tools/ThemeDetector';
import Toast from './comps/Toast';
import RecentChats from './pages/navigations/RecentChats';
import { ChatBubbleIcon, Setting1Icon, UserListIcon } from 'tdesign-icons-react';
import ColorModeSwitch from './comps/ColorModeSwitch';
import Contacts from './pages/navigations/Contacts';
import Settings from './pages/navigations/Settings';
import GeneralSettings from './pages/settings/General';
import ProfileSettings from './pages/settings/MyProfile';
import PrivacySettings from './pages/settings/Privacy';
import Modal, { DialogInfo } from './comps/Modal';
import UserView from './pages/UserView';
import NewFriend from './pages/NewFriend';
import Auth from './pages/covers/Auth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { conversations as convApi, files, friends as friendsApi } from './api';
import ChangePassword from './pages/settings/ChangePassword';
import Blacklist from './pages/settings/Blacklist';
import SettingsHome from './pages/settings/Home';
import { ChattySocket as socketService, type User } from 'chatty-sdk';
import About from './pages/settings/About';

export interface ReusableFuncsDef {
    setChat: Function;
    setUserView: Function;
    setSettings: Function;
    goHome: Function;
    goTo: Function;
    themeMgr: ThemeHelper;
    modalUpdate: Function;
}

export interface ModalControl {
    info: DialogInfo;
    showing: boolean;
    customChildren?: ReactNode;
}

export const ReusableFuncs = createContext<ReusableFuncsDef | null>(null);

function resolveNavFromPath(pathname: string): "recents" | "contacts" | "settings" {
    if (pathname.startsWith('/settings')) {
        return 'settings';
    }
    if (pathname.startsWith('/newfriend') || pathname.startsWith('/user')) {
        return 'contacts';
    }
    return 'recents';
}

function Badge({ count }: {
    count: number;
}) {
    if (count <= 0) {
        return null;
    }
    return (<span className='absolute -top-1 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center shadow'>
        {count > 99 ? '99+' : count}
    </span>);
}

function AppScope({ side, setSide, mgr }: {
    side: "right" | "left";
    setSide: Function;
    mgr: ThemeHelper;
}) {

    const auth = useAuth();
    const [user, setUser] = useState<User | null>(auth.user);
    const mobileScreen = useRef<HTMLDivElement | null>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [nav, setNav] = useState<"recents" | "contacts" | "settings">("recents");
    const [unreadMsg, setUnreadMsg] = useState(0);
    const [pendingReq, setPendingReq] = useState(0);
    const [modal, setModal] = useState<ModalControl>({
        info: new DialogInfo("", "notset", () => { }),
        showing: false,
        customChildren: undefined
    });
    const mobNav = {
        goHome: () => {
            setSide("left");
            navigate("/");
        },
        goTo: (path: string) => {
            navigate(path);
            setSide("right");
        }
    };
    const fetchBadges = useCallback(async () => {
        try {
            const [convRes, reqRes] = await Promise.all([
                convApi.getConversations(),
                friendsApi.getFriendRequests('received'),
            ]);
            const convList = convRes.data.data || [];
            const reqList = reqRes.data.data || [];
            const totalUnread = convList.reduce((sum: number, item: any) => sum + (item.unread_count || 0), 0);
            setUnreadMsg(totalUnread);
            setPendingReq(reqList.length);
        }
        catch {
        }
    }, []);
    useEffect(() => {
        setUser(auth.user);
    }, [auth]);
    useEffect(() => {
        let i = setInterval(() => {
            if (auth.isLoggedIn) fetchBadges();
        }, 1000);
        const offMsg = socketService.onMessage(() => fetchBadges());
        const offRecall = socketService.onMessageRecalled(() => fetchBadges());
        const offRead = socketService.onMessageReadAck(() => fetchBadges());
        const offReq = socketService.onFriendRequest(() => fetchBadges());
        const offAccepted = socketService.onFriendAccepted(() => fetchBadges());
        return () => {
            clearInterval(i);
            offMsg();
            offRecall();
            offRead();
            offReq();
            offAccepted();
        };
    }, [fetchBadges, auth.isLoggedIn]);
    useEffect(() => {
        setNav(resolveNavFromPath(location.pathname));
        setSide(location.pathname === '/' ? 'left' : 'right');
    }, [location.pathname, setSide]);
    const displayName = user?.display_name || user?.username || 'User';
    const avatarUrl = user?.avatar_locator ? files.getFileUrl(user.avatar_locator) : null;
    const initial = displayName[0]?.toUpperCase() || '?';
    return <ReusableFuncs.Provider value={{
        setChat: (id: string) => {
            mobNav.goTo(`/chat/${id}`);
        },
        setUserView: (id: string) => {
            mobNav.goTo(`/user/${id}`);
        },
        setSettings: (id: string) => {
            mobNav.goTo(`/settings/${id}`);
        },
        goHome: mobNav.goHome,
        goTo: mobNav.goTo,
        themeMgr: mgr,
        modalUpdate: setModal
    }}>
        <div id='appscope' className=' 
                sm:grid! sm:grid-cols-8 gap-0 sm:gap-3
                flex flex-row 
                transition relative top-0 left-0 right-0 bottom-0 init? w-full max-h-screen
        '>
            <div id='navigative' style={{ pointerEvents: 'visiblePainted' }} className={`${side == "left" ? 'grow nav-show' : 'nav-hide sm:block'}
                 sm:col-span-3 lg:col-span-2 flex flex-col max-h-screen rounded-lg overflow-hidden
                 min-h-0
                 `}>
                <div id='logged-in' className='p-2 bg-slate-100/50 dark:bg-slate-200/15 shadow-md rounded-none rounded-b-lg sm:rounded-lg! block-shadow shrink-0 flex flex-row items-center gap-1.5'>
                    <button type='button' className='contents cursor-pointer' onClick={() => mobNav.goTo('/settings')}>
                        {avatarUrl ? (<img src={avatarUrl} className='rounded-full block-shadow aspect-square shrink-0 w-8 h-8 sm:w-12 sm:h-12 object-cover' />) : (<div className='rounded-full block-shadow aspect-square shrink-0 w-8 h-8 sm:w-12 sm:h-12 bg-[#1277d6] flex items-center justify-center text-white font-bold text-sm sm:text-lg'>
                            {initial}
                        </div>)}
                    </button>
                    <button type='button' className='grid grid-cols-1 grow items-center text-left cursor-pointer' onClick={() => mobNav.goTo('/settings')}>
                        <h3 id='username' className='text-ellipsis overflow-hidden text-nowrap font-semibold'>{displayName}</h3>
                        <p id='bio-state' className='hidden sm:block text-sm/4 text-nowrap text-ellipsis overflow-hidden '>
                            Chatty ID: {user?.username || '-'}
                        </p>
                    </button>
                    <div className='hidden sm:grid grid-cols-1 shrink-0 gap-2'>
                        <ColorModeSwitch mgr={mgr} className='border-button' />
                        <div className='grid items-center border-button' onClick={() => mobNav.goTo('/settings')}>
                            <Setting1Icon fillColor='transparent' size='large' className='block' strokeColor='currentColor' strokeWidth={2} />
                        </div>
                    </div>
                </div>
                <div className='pt-3! px-3 sm:p-0 rounded-lg grow h-full overflow-hidden'>
                    <div id="nav-scr" className='w-full h-full'>
                        {(() => {
                            switch (nav) {
                                default:
                                case "recents":
                                    return <RecentChats openUserSearch={() => mobNav.goTo('/newfriend')} gotoContacts={() => setNav("contacts")} />;
                                case "contacts":
                                    return <Contacts navGoBack={() => setNav("recents")} />;
                                case "settings":
                                    return <Settings navGoBack={() => setNav("recents")} />;
                            }
                        })()}
                    </div>
                </div>
                <div className='p-3 sm:hidden pt-0'>
                    <div className='rounded-lg bg-slate-200/30 grid grid-cols-3 items-center overflow-hidden shadow-md'>
                        <div onClick={() => setNav("recents")} className={`grid items-center justify-items-center active:bg-slate-300/30 p-1.5 ${nav == "recents" ? 'bg-slate-300/50' : ''}`}>
                            <div className='text-center relative'>
                                <ChatBubbleIcon size='large' fillColor='transparent' className='block mx-auto' strokeColor='currentColor' strokeWidth={2} />
                                <Badge count={unreadMsg} />
                                <p className='text-sm mt-0.5'>Messages</p>
                            </div>
                        </div>
                        <div onClick={() => setNav("contacts")} className={`grid items-center justify-items-center active:bg-slate-300/30 p-1.5 ${nav == "contacts" ? 'bg-slate-300/50' : ''}`}>
                            <div className='text-center relative'>
                                <UserListIcon fillColor='transparent' size='large' className='block mx-auto' strokeColor='currentColor' strokeWidth={2} />
                                <Badge count={pendingReq} />
                                <p className='text-sm mt-0.5'>Contacts</p>
                            </div>
                        </div>
                        <div onClick={() => setNav("settings")} className={`grid items-center justify-items-center active:bg-slate-300/30 p-1.5 ${nav == "settings" ? 'bg-slate-300/50' : ''}`}>
                            <div className='text-center'>
                                <Setting1Icon fillColor='transparent' size='large' className='block mx-auto' strokeColor='currentColor' strokeWidth={2} />
                                <p className='text-sm mt-0.5'>Settings</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`
                ${side == "right" ? 'grow nav-show' : 'nav-hide sm:block'} 
                sm:col-span-5 lg:col-span-6 bg-slate-200/80 dark:bg-slate-600/80 sm:rounded-lg h-full overflow-hidden
            `}>
                <div className='overflow-x-hidden overflow-y-auto? w-full h-screen sm:h-full p-3' ref={mobileScreen}>
                    <Routes>
                        <Route path='/chat' element={<Conversation />} />
                        <Route path='/chat/:chatId' element={<Conversation />} />
                        <Route path='/settings' element={<SettingsHome />} />
                        <Route path='/settings/privacy' element={<PrivacySettings />} />
                        <Route path='/settings/about' element={<About />} />
                        <Route path='/settings/profile' element={<ProfileSettings />} />
                        <Route path='/settings/general' element={<GeneralSettings />} />
                        <Route path='/settings/password' element={<ChangePassword />} />
                        <Route path='/settings/blacklist' element={<Blacklist />} />
                        <Route path='/user/:userId' element={<UserView />} />
                        <Route path='/newfriend' element={<NewFriend />} />
                        <Route path='/*' element={<Index />} />
                    </Routes>
                </div>
            </div>
        </div>
        <Modal activated={modal.showing} info={modal.info} shut={() => {
            setModal(current => ({ ...current, showing: false }));
        }}>
            {modal.customChildren}
        </Modal>
    </ReusableFuncs.Provider>;
}
export const ToastableContext = createContext<Function>(() => { });
function Layout() {
    const mgr = useThemeDetector();
    const [, setState] = useState(false);
    mgr.bindedUpdater = () => setState(current => !current);
    const toast = useRef<any>(null);
    const pushToast = () => {
        if (toast.current)
            return toast.current.PushToast;
    };
    const [side, setSide] = useState<"left" | "right">("left");
    return <>
        <ToastableContext.Provider value={pushToast}>
            <AuthProvider>
                <AuthGate side={side} setSide={setSide} mgr={mgr} />
            </AuthProvider>
        </ToastableContext.Provider>
        <Toast ref={toast} />
    </>;
}
function AuthGate({ side, setSide, mgr }: {
    side: "left" | "right";
    setSide: Function;
    mgr: ThemeHelper;
}) {
    const { isLoggedIn, isLoading } = useAuth();

    const [modal, setModal] = useState<ModalControl>({
        info: new DialogInfo("", "notset", () => { }),
        showing: false,
        customChildren: undefined
    });

    if (isLoading) {
        return (<div className='bg-slate-50 sm:bg-[#c3ccd8] dark:bg-slate-800 overflow-hidden sm:h-[80vh] 
                min-h-75 w-full sm:max-w-125 block-shadow h-full relative p-3 sm:rounded-lg grid items-center justify-items-center'>
            <div className='text-center'>
                <div className='animate-spin w-8 h-8 border-3 border-[#1277d6] border-t-transparent rounded-full mx-auto mb-3'></div>
                <p className='text-slate-500'>Loading...</p>
            </div>
        </div>);
    }
    if (!isLoggedIn) {
        return <ReusableFuncs.Provider value={{
            modalUpdate: setModal
        } as unknown as ReusableFuncsDef}>
            <div className='bg-slate-50 sm:bg-[#c3ccd8] dark:bg-slate-800 overflow-hidden sm:h-[80vh] 
                min-h-75 w-full sm:max-w-125 block-shadow h-full relative p-3 sm:rounded-lg grid items-center'>
                <Auth />
                <Modal activated={modal.showing} info={modal.info} shut={() => {
                    setModal(current => ({ ...current, showing: false }));
                }}>
                    {modal.customChildren}
                </Modal>
            </div>
        </ReusableFuncs.Provider>;
    }
    return (<BrowserRouter>
        <div className='bg-slate-50 sm:bg-[#c3ccd8] dark:bg-slate-800 overflow-hidden sm:max-w-5xl sm:h-[80vh] 
                min-h-75 w-full block-shadow h-full relative p-0 sm:p-3 sm:rounded-lg flex'>
            <AppScope side={side} setSide={setSide} mgr={mgr} />
        </div>
    </BrowserRouter>);
}
createRoot(document.getElementById('root')!).render(<Layout />);


// todo
// replace using sdk
// here to create a client, find the localStorage if here's a SET endpoint
// if NO, use DEFAULT.
// expose by using export

// const CCC = 
// const CC = ..client
// export .....each parts.
