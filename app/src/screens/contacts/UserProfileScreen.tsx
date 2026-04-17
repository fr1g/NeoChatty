import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, ScrollView, } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation';
import { users, friends, blocks, files } from '../../api';
import { UserProfile } from '../../types';
type Nav = NativeStackNavigationProp<RootStackParamList>;
const PRIMARY = '#1277d6';
export default function UserProfileScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<Nav>();
    const { userId } = route.params as {
        userId: number;
    };
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const loadProfile = async () => {
        try {
            const res = await users.getUserProfile(userId);
            setProfile(res.data.data ?? null);
        }
        catch {
            Alert.alert('Error', 'Failed to load the user profile');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadProfile();
    }, [userId]);
    const sendRequest = async () => {
        setActionLoading(true);
        try {
            await friends.sendFriendRequest(userId);
            Alert.alert('Friend request sent');
            loadProfile();
        }
        catch {
            Alert.alert('Error', 'Failed to send friend request');
        }
        finally {
            setActionLoading(false);
        }
    };
    const handleRequest = async (status: 'accepted' | 'rejected') => {
        setActionLoading(true);
        try {
            const reqId = (profile as any)?.friend_request_id;
            if (!reqId)
                throw new Error('No request id');
            await friends.handleFriendRequest(reqId, status);
            Alert.alert('Success', status === 'accepted' ? 'Friend request accepted' : 'Friend request rejected');
            loadProfile();
        }
        catch {
            Alert.alert('Error', 'The action could not be completed');
        }
        finally {
            setActionLoading(false);
        }
    };
    const deleteFriend = () => {
        Alert.alert('Remove Friend', 'Remove this friend? They will not be notified.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await friends.deleteFriend(userId);
                        Alert.alert('Friend removed');
                        loadProfile();
                    }
                    catch {
                        Alert.alert('Error', 'Failed to remove friend');
                    }
                },
            },
        ]);
    };
    const blockUser = () => {
        Alert.alert('Add to Blocklist', 'You will no longer receive messages or friend requests from this user', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await blocks.blockUser(userId);
                        Alert.alert('Success', 'User added to blocklist');
                        loadProfile();
                    }
                    catch {
                        Alert.alert('Error', 'Failed to block user');
                    }
                },
            },
        ]);
    };
    const unblock = async () => {
        try {
            await blocks.unblockUser(userId);
            Alert.alert('Success', 'User removed from blocklist');
            loadProfile();
        }
        catch {
            Alert.alert('Error', 'Failed to unblock user');
        }
    };
    const goChat = () => {
        if (!profile)
            return;
        navigation.navigate('Chat', {
            peerId: profile.id,
            peerName: profile.display_name || profile.username || '?',
            peerAvatar: profile.avatar_locator,
        });
    };
    if (loading) {
        return (<View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
        </View>);
    }
    if (!profile) {
        return (<View style={styles.center}>
            <Ionicons name="person-outline" size={64} color="#D1D5DB" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Sorry, the profile could not be loaded</Text>
        </View>);
    }
    const renderActions = () => {
        switch (profile.relationship) {
            case 'stranger':
                return (<TouchableOpacity style={styles.primaryBtn} onPress={sendRequest} disabled={actionLoading} activeOpacity={0.8}>
                    <Ionicons name="person-add" size={20} color="#fff" style={styles.btnIcon} />
                    <Text style={styles.primaryBtnText}>Add Friend</Text>
                </TouchableOpacity>);
            case 'pending_sent':
                return (<View style={[styles.primaryBtn, styles.disabledBtn]}>
                    <Ionicons name="time" size={20} color="#9CA3AF" style={styles.btnIcon} />
                    <Text style={styles.disabledBtnText}>Request sent, waiting for response</Text>
                </View>);
            case 'pending_received':
                return (<View style={styles.btnRow}>
                    <TouchableOpacity style={[styles.primaryBtn, { flex: 1.5 }]} onPress={() => handleRequest('accepted')} disabled={actionLoading} activeOpacity={0.8}>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" style={styles.btnIcon} />
                        <Text style={styles.primaryBtnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => handleRequest('rejected')} disabled={actionLoading} activeOpacity={0.6}>
                        <Text style={[styles.outlineBtnText, { color: '#6B7280' }]}>Reject</Text>
                    </TouchableOpacity>
                </View>);
            case 'friend':
                return (<>
                    <TouchableOpacity style={styles.primaryBtn} onPress={goChat} activeOpacity={0.8}>
                        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" style={styles.btnIcon} />
                        <Text style={styles.primaryBtnText}>Message</Text>
                    </TouchableOpacity>

                    <View style={[styles.btnRow, { marginTop: 12 }]}>
                        <TouchableOpacity style={[styles.dangerBtn, { flex: 1 }]} onPress={deleteFriend} activeOpacity={0.6}>
                            <Ionicons name="person-remove-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                            <Text style={styles.dangerBtnText}>Remove Friend</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.dangerBtn, { flex: 1 }]} onPress={blockUser} activeOpacity={0.6}>
                            <Ionicons name="shield-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                            <Text style={styles.dangerBtnText}>Add to Blocklist</Text>
                        </TouchableOpacity>
                    </View>
                </>);
            case 'blocked':
                return (<View style={styles.blockedContainer}>
                    <Ionicons name="lock-closed" size={36} color="#9CA3AF" style={{ marginBottom: 12 }} />
                    <Text style={styles.blockedText}>This user is in your blocklist</Text>
                    <TouchableOpacity style={[styles.outlineBtn, { marginTop: 16 }]} onPress={unblock} activeOpacity={0.6}>
                        <Text style={styles.outlineBtnText}>Remove from Blocklist</Text>
                    </TouchableOpacity>
                </View>);
            default:
                return null;
        }
    };
    return (<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.bgArea}>
            {profile.background_locator ? (<Image source={files.getFileSource(profile.background_locator)} style={styles.bgImage} resizeMode="cover" />) : (<View style={[styles.bgImage, styles.defaultBackground]}>
                <View style={styles.bgDecorationCircle} />
            </View>)}
        </View>


        <View style={styles.profileCard}>
            <View style={styles.avatarWrapper}>
                {profile.avatar_locator ? (<Image source={files.getFileSource(profile.avatar_locator)} style={styles.avatar} />) : (<View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>
                        {(profile.display_name || '?')[0].toUpperCase()}
                    </Text>
                </View>)}
            </View>

            <Text style={styles.displayName}>{profile.display_name || 'User'}</Text>
            <Text style={styles.username}>Chatty ID: {profile.username}</Text>


            {profile.relationship === 'friend' && (<View style={styles.relationshipBadge}>
                <Ionicons name="people" size={14} color={PRIMARY} style={{ marginRight: 4 }} />
                <Text style={styles.relationshipText}>You are already friends</Text>
            </View>)}
        </View>


        <View style={styles.actionCard}>
            {renderActions()}
        </View>
    </ScrollView>);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    bgArea: {
        height: 220,
        backgroundColor: PRIMARY,
    },
    bgImage: {
        width: '100%',
        height: '100%',
    },
    defaultBackground: {
        backgroundColor: '#1277d6',
        overflow: 'hidden',
    },
    bgDecorationCircle: {
        position: 'absolute',
        top: -30,
        right: -20,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    profileCard: {
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingBottom: 24,
        marginTop: -40,
        marginHorizontal: 16,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 4,
        zIndex: 10,
    },
    avatarWrapper: {
        marginTop: -40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 12,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 24,
        borderWidth: 4,
        borderColor: '#ffffff',
        backgroundColor: '#F3F4F6',
    },
    avatarPlaceholder: {
        width: 90,
        height: 90,
        borderRadius: 24,
        borderWidth: 4,
        borderColor: '#ffffff',
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 36,
        fontWeight: '800',
    },
    displayName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
    },
    username: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
    },
    relationshipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(7, 193, 96, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    relationshipText: {
        color: PRIMARY,
        fontSize: 12,
        fontWeight: '600',
    },
    actionCard: {
        backgroundColor: '#ffffff',
        margin: 16,
        marginTop: 12,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    primaryBtn: {
        flexDirection: 'row',
        backgroundColor: PRIMARY,
        borderRadius: 14,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
    },
    btnIcon: {
        marginRight: 8,
    },
    disabledBtn: {
        backgroundColor: '#F3F4F6',
        shadowOpacity: 0,
        elevation: 0,
    },
    disabledBtnText: {
        color: '#9CA3AF',
        fontSize: 16,
        fontWeight: '600',
    },
    outlineBtn: {
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    outlineBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
    dangerBtn: {
        flexDirection: 'row',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FEE2E2',
        borderRadius: 14,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dangerBtnText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '600',
    },
    btnRow: {
        flexDirection: 'row',
        gap: 12,
    },
    blockedContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    blockedText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    emptyText: {
        fontSize: 16,
        color: '#9CA3AF',
        fontWeight: '500',
    },
});
