import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image, Alert, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation';
import { friends, files } from '../../api';
import { User } from '../../types';
import { onUserOnline, onUserOffline } from '../../services/socket';
type Nav = NativeStackNavigationProp<RootStackParamList>;
const PRIMARY = '#1277d6';
export default function ContactsScreen() {
    const navigation = useNavigation<Nav>();
    const [friendList, setFriendList] = useState<User[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const loadFriends = useCallback(async () => {
        try {
            const res = await friends.getFriends();
            setFriendList(res.data.data ?? []);
        }
        catch {
            Alert.alert('Error', 'Failed to load contacts');
        }
    }, []);
    useFocusEffect(useCallback(() => {
        loadFriends();
    }, [loadFriends]));
    useEffect(() => {
        const offOnline = onUserOnline((data: {
            userId: number;
        }) => {
            setFriendList(prev => prev.map(f => f.id === data.userId ? { ...f, is_online: true } : f));
        });
        const offOffline = onUserOffline((data: {
            userId: number;
        }) => {
            setFriendList(prev => prev.map(f => f.id === data.userId ? { ...f, is_online: false } : f));
        });
        return () => { offOnline(); offOffline(); };
    }, []);
    const onRefresh = async () => {
        setRefreshing(true);
        await loadFriends();
        setRefreshing(false);
    };
    const actions = [
        { label: 'Add Friend', icon: 'person-add-outline', screen: 'UserSearch' as const },
        { label: 'New Friends', icon: 'mail-unread-outline', screen: 'FriendRequestList' as const },
        { label: 'Blocklist', icon: 'shield-outline', screen: 'Blacklist' as const },
    ];
    const renderAvatar = (user: User) => {
        if (user.avatar_locator) {
            return (<Image source={files.getFileSource(user.avatar_locator)} style={styles.avatar} />);
        }
        const letter = (user.display_name || user.username || '?')[0].toUpperCase();
        return (<View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>{letter}</Text>
        </View>);
    };
    const renderFriend = ({ item }: {
        item: User & {
            is_online?: boolean;
        };
    }) => {
        const name = item.display_name || item.username;
        return (<TouchableOpacity style={styles.friendCard} activeOpacity={0.7} onPress={() => navigation.navigate('Chat', {
            peerId: item.id,
            peerName: name,
            peerAvatar: item.avatar_locator,
        })}>
            <View style={styles.avatarContainer}>
                {renderAvatar(item)}
                <View style={[
                    styles.onlineIndicator,
                    { backgroundColor: item.is_online ? PRIMARY : '#D1D5DB' },
                ]} />
            </View>

            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{name}</Text>
                <Text style={styles.friendStatus} numberOfLines={1}>
                    {item.is_online ? 'Online now' : 'Offline'}
                </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </TouchableOpacity>);
    };
    return (<SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Contacts</Text>
        </View>

        <View style={styles.actionGrid}>
            {actions.map((a) => (<TouchableOpacity key={a.screen} style={styles.actionCard} activeOpacity={0.7} onPress={() => navigation.navigate(a.screen)}>
                <View style={styles.iconWrapper}>
                    <Ionicons name={a.icon as any} size={28} color={PRIMARY} />
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>))}
        </View>

        <View style={styles.listHeader}>
            <Text style={styles.listTitle}>All Contacts</Text>
            <Text style={styles.listCount}>{friendList.length} contacts</Text>
        </View>

        <FlatList data={friendList} keyExtractor={(item) => String(item.id)} renderItem={renderFriend} contentContainerStyle={[styles.listContent, friendList.length === 0 && styles.emptyList]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />} ListEmptyComponent={<>
            <Ionicons name="people-circle-outline" size={60} color="#E5E7EB" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No contacts yet</Text>
            <Text style={styles.emptySubText}>Use "Add Friend" to meet someone new</Text>
        </>} />
    </SafeAreaView>);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 20,
        paddingVertical: 16,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
    },
    actionGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 20,
        backgroundColor: '#F3F4F6',
        marginVertical: 4,
    },
    actionCard: {
        width: '31%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
    },
    iconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(7, 193, 96, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionLabel: {
        color: '#374151',
        fontSize: 13,
        fontWeight: '600',
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    listTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    listCount: {
        fontSize: 13,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
    },
    avatarPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    friendInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    friendName: {
        fontSize: 17,
        color: '#111827',
        fontWeight: '600',
        marginBottom: 4,
    },
    friendStatus: {
        fontSize: 13,
        color: '#6B7280',
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 6,
    },
    emptySubText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
});
