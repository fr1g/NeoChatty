import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { conversations as convApi, friends as friendsApi } from '../api';
import * as socketService from '../services/socket';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ConversationListScreen from '../screens/chat/ConversationListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import ContactsScreen from '../screens/contacts/ContactsScreen';
import FriendRequestListScreen from '../screens/contacts/FriendRequestListScreen';
import UserSearchScreen from '../screens/contacts/UserSearchScreen';
import UserProfileScreen from '../screens/contacts/UserProfileScreen';
import BlacklistScreen from '../screens/contacts/BlacklistScreen';
import MyProfileScreen from '../screens/profile/MyProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import PrivacySettingsScreen from '../screens/profile/PrivacySettingsScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';

export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    Main: undefined;
    Chat: {
        peerId: number;
        peerName: string;
        peerAvatar?: string | null;
    };
    FriendRequestList: undefined;
    UserSearch: undefined;
    UserProfile: {
        userId: number;
    };
    Blacklist: undefined;
    EditProfile: undefined;
    ChangePassword: undefined;
    PrivacySettings: undefined;
    Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

export const NavMethods = createContext<{ fetchBadge: (() => void) | null }>({ fetchBadge: null });
function MainTabs() {

    const [unreadMsg, setUnreadMsg] = useState(0);
    const [pendingReq, setPendingReq] = useState(0);
    const [updater, setUpdater] = useState(false);
    const fetchBadges = useCallback(async () => {
        try {
            const [convRes, reqRes] = await Promise.all([
                convApi.getConversations(),
                friendsApi.getFriendRequests('received'),
            ]);
            const convList = convRes.data.data || [];
            const totalUnread = convList.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0);
            setUnreadMsg(totalUnread);
            const reqList = reqRes.data.data || [];
            setPendingReq(reqList.length);
        }
        catch { }
    }, []);

    const x = useContext(NavMethods);
    useEffect(() => {
        fetchBadges();
        const offMsg = socketService.onMessage(() => fetchBadges());
        const offRecall = socketService.onMessageRecalled(() => fetchBadges());
        const offRead = socketService.onMessageReadAck(() => fetchBadges());
        const offReq = socketService.onFriendRequest(() => fetchBadges());
        const offAccepted = socketService.onFriendAccepted(() => fetchBadges());

        if (x.fetchBadge == null) {
            x.fetchBadge = fetchBadges;
        }

        return () => { offMsg(); offRecall(); offRead(); offReq(); offAccepted(); };
    }, [fetchBadges, updater]);

    return (<Tab.Navigator screenOptions={{
        tabBarActiveTintColor: '#1277d6',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarStyle: { borderTopColor: '#eee', borderTopWidth: 0.5 },
    }}>
        <Tab.Screen name="Messages" component={ConversationListScreen} options={{
            tabBarIcon: ({ color, size }) => (<Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />),
            tabBarBadge: unreadMsg > 0 ? (unreadMsg > 99 ? '99+' : unreadMsg) : undefined,
        }} />
        <Tab.Screen name="Contacts" component={ContactsScreen} options={{
            tabBarIcon: ({ color, size }) => (<Ionicons name="people-outline" size={size} color={color} />),
            tabBarBadge: pendingReq > 0 ? pendingReq : undefined,
        }} />
        <Tab.Screen name="Me" component={MyProfileScreen} options={{
            tabBarIcon: ({ color, size }) => (<Ionicons name="person-outline" size={size} color={color} />),
        }} />
    </Tab.Navigator>);
}


export default function Navigation() {
    const { isLoggedIn, isLoading } = useAuth();
    if (isLoading) {
        return (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <ActivityIndicator size="large" color="#1277d6" />
        </View>);
    }
    return (<NavMethods.Provider value={{ fetchBadge: null }}>
        <NavigationContainer >
            <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
                {isLoggedIn ? (<>
                    <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
                    <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params.peerName })} />
                    <Stack.Screen name="FriendRequestList" component={FriendRequestListScreen} options={{ title: 'Friend Requests' }} />
                    <Stack.Screen name="UserSearch" component={UserSearchScreen} options={{ title: 'Search Users' }} />
                    <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'User Profile' }} />
                    <Stack.Screen name="Blacklist" component={BlacklistScreen} options={{ title: 'Blocklist' }} />
                    <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
                    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
                    <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} options={{ title: 'Privacy Settings' }} />
                    <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
                </>) : (<>
                    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Sign Up' }} />
                </>)}
            </Stack.Navigator>
        </NavigationContainer>
    </NavMethods.Provider>);
}
