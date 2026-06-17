import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { User } from 'chatty-sdk';
import { auth, client, users } from '../api/index';
import { setTokens, getTokens, clearTokens, setOnAuthExpired } from '../api/client';
import { ChattySocket as socketService } from 'chatty-sdk';

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isLoggedIn: boolean;
}

interface TokenPair {
    accessToken: string | null;
    refreshToken: string | null;
}

interface AuthContextType extends AuthState {
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, display_name?: string) => Promise<void>;
    logout: () => void;
    updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: {
    children: ReactNode;
}) {
    const [state, setState] = useState<AuthState>({
        user: null,
        isLoading: true,
        isLoggedIn: false,
    });
    const [t, setT] = useState<TokenPair>({ accessToken: null, refreshToken: null });

    function _setTokens(accessToken: string | null, refreshToken: string | null) {
        setT({ accessToken, refreshToken });
        if (accessToken && refreshToken) {
            setTokens(accessToken, refreshToken);
        }
    }

    const logoutRef = useRef<(() => void) | undefined>(undefined);
    const logout = useCallback(() => {
        socketService.disconnect();
        clearTokens();
        setState({ user: null, isLoading: false, isLoggedIn: false });
    }, []);
    logoutRef.current = logout;
    useEffect(() => {
        setOnAuthExpired(() => {
            logoutRef.current?.();
        });
    }, []);
    useEffect(() => {
        (async () => {
            // console.log(`cfg`, client?.config ?? null, client ?? null)
            try {
                const tokens = getTokens();
                if (tokens.accessToken || t.accessToken) {
                    const res = await users.getMyProfile();
                    const userData = res.data.data as any;
                    setState({ user: userData, isLoading: false, isLoggedIn: true });
                    console.log('trying to connect to socket')
                    socketService.connect(tokens.accessToken ? tokens : t, client.config.getSocket());
                    // console.log(socketService)
                }
                else {
                    setState({ user: null, isLoading: false, isLoggedIn: false });
                }
            }
            catch {
                clearTokens();
                setState({ user: null, isLoading: false, isLoggedIn: false });
            }
        })();
    }, []);
    useEffect(() => {
        if (!state.isLoggedIn)
            return;
        const offForceDisconnect = socketService.onForceDisconnect(() => {
            logoutRef.current?.();
        });
        return () => { offForceDisconnect(); };
    }, [state.isLoggedIn]);
    const login = useCallback(async (username: string, password: string) => {
        const res = await auth.login(username, password);
        const data = res.data.data as any;
        _setTokens(data.accessToken, data.refreshToken);
        setState({ user: data.user, isLoading: false, isLoggedIn: true });
        socketService.connect({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
        }, client.config.getSocket());
    }, []);
    const register = useCallback(async (username: string, password: string, display_name?: string) => {
        const res = await auth.register(username, password, display_name);
        const data = res.data.data as any;
        _setTokens(data.accessToken, data.refreshToken);
        setState({ user: data.user, isLoading: false, isLoggedIn: true });
        socketService.connect({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
        }, client.config.getSocket());
    }, []);
    const updateUser = useCallback((userData: Partial<User>) => {
        setState((prev) => {
            if (!prev.user)
                return prev;
            return { ...prev, user: { ...prev.user, ...userData } };
        });
    }, []);
    return (<AuthContext.Provider value={{ ...state, login, register, logout, updateUser }}>
        {children}
    </AuthContext.Provider>);
}
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
