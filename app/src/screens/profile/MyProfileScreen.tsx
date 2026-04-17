import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation';
import { useAuth } from '../../context/AuthContext';
import { users, files } from '../../api';
type Nav = NativeStackNavigationProp<RootStackParamList>;
const PRIMARY = '#1277d6';
const menuItems: {
    label: string;
    icon: string;
    screen: keyof RootStackParamList;
}[] = [
        { label: 'Edit Profile', icon: 'person-circle-outline', screen: 'EditProfile' },
        { label: 'Change Password', icon: 'key-outline', screen: 'ChangePassword' },
        { label: 'Privacy Settings', icon: 'shield-checkmark-outline', screen: 'PrivacySettings' },
    ];
export default function MyProfileScreen() {
    const navigation = useNavigation<Nav>();
    const { user, updateUser, logout } = useAuth();
    useFocusEffect(useCallback(() => {
        (async () => {
            try {
                const res = await users.getMyProfile();
                const data = res.data.data;
                if (data)
                    updateUser(data);
            }
            catch { }
        })();
    }, [updateUser]));
    const handleLogout = () => {
        Alert.alert('Sign Out', 'Sign out of this account?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', style: 'destructive', onPress: logout },
        ]);
    };
    const renderBackground = () => {
        if (user?.background_locator) {
            return (<Image source={files.getFileSource(user?.background_locator)} style={styles.backgroundArea} resizeMode="cover" />);
        }
        return (<View style={[styles.backgroundArea, styles.defaultBackground]}>

            <View style={styles.bgDecorationCircle} />
        </View>);
    };
    const renderAvatar = () => {
        if (user?.avatar_locator) {
            return (<Image source={files.getFileSource(user?.avatar_locator)} style={styles.avatar} />);
        }
        const letter = (user?.display_name || user?.username || '?')[0].toUpperCase();
        return (<View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>{letter}</Text>
        </View>);
    };
    return (<SafeAreaView style={styles.container} edges={['top']}>
        {renderBackground()}


        <View style={styles.header}>
            <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.profileCard}>
                <View style={styles.avatarWrapper}>{renderAvatar()}</View>
                <View style={styles.profileInfo}>
                    <Text style={styles.displayName}>
                        {user?.display_name || user?.username || 'User'}
                    </Text>
                    <Text style={styles.username}>Chatty ID: {user?.username || '-'}</Text>

                    <View style={styles.statusBadge}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>Online status</Text>
                    </View>
                </View>
            </View>

            <View style={styles.menuSection}>
                {menuItems.map((item, idx) => (<TouchableOpacity key={item.screen} style={[
                    styles.menuItem,
                    idx === menuItems.length - 1 && { borderBottomWidth: 0 },
                ]} activeOpacity={0.6} onPress={() => navigation.navigate(item.screen as never)}>
                    <View style={styles.menuIconWrapper}>
                        <Ionicons name={item.icon as any} size={22} color="#4B5563" />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>))}
            </View>


            <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" style={styles.logoutIcon} />
                <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={styles.versionText}>Chatty v1.0.0</Text>
        </ScrollView>
    </SafeAreaView>);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#ffffff',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    backgroundArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 240,
        backgroundColor: PRIMARY,
        overflow: 'hidden',
    },
    defaultBackground: {
        backgroundColor: PRIMARY,
    },
    bgDecorationCircle: {
        position: 'absolute',
        top: -50,
        right: -20,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    scrollContent: {
        paddingTop: 120,
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 6,
    },
    avatarWrapper: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#ffffff',
        backgroundColor: '#F3F4F6',
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '800',
    },
    profileInfo: {
        marginLeft: 20,
        flex: 1,
    },
    displayName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
    },
    username: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: PRIMARY,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '500',
    },
    menuSection: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        paddingVertical: 8,
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F3F4F6',
    },
    menuIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
    },
    logoutButton: {
        flexDirection: 'row',
        height: 56,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    logoutIcon: {
        marginRight: 8,
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 17,
        fontWeight: '700',
    },
    versionText: {
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 13,
        marginTop: 20,
    },
});
