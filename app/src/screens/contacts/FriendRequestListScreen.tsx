import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, RefreshControl, } from 'react-native';
import { friends, files } from '../../api';
import { FriendRequest, User } from '../../types';
const PRIMARY = '#1277d6';
export default function FriendRequestListScreen() {
    const [tab, setTab] = useState<'received' | 'sent'>('received');
    const [list, setList] = useState<FriendRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const loadRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await friends.getFriendRequests(tab);
            setList(res.data.data ?? []);
        }
        catch {
            Alert.alert('Error', 'Failed to load friend requests');
        }
        finally {
            setLoading(false);
        }
    }, [tab]);
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const res = await friends.getFriendRequests(tab);
            setList(res.data.data ?? []);
        }
        catch { }
        setRefreshing(false);
    }, [tab]);
    useEffect(() => {
        loadRequests();
    }, [loadRequests]);
    const handleRequest = async (id: number, status: 'accepted' | 'rejected') => {
        try {
            await friends.handleFriendRequest(id, status);
            setList((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        }
        catch {
            Alert.alert('Error', 'Action failed');
        }
    };
    const renderAvatar = (user?: User) => {
        if (!user)
            return <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>?</Text></View>;
        if (user.avatar_locator) {
            return <Image source={files.getFileSource(user.avatar_locator)} style={styles.avatar} />;
        }
        const letter = (user.display_name || '?')[0].toUpperCase();
        return (<View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>{letter}</Text>
        </View>);
    };
    const statusLabel: Record<string, string> = {
        pending: 'Pending',
        accepted: 'Accepted',
        rejected: 'Rejected',
    };
    const renderItem = ({ item }: {
        item: FriendRequest;
    }) => {
        const user = tab === 'received' ? item.fromUser : item.toUser;
        return (<View style={styles.row}>
            {renderAvatar(user)}
            <View style={styles.info}>
                <Text style={styles.name}>{user?.display_name ?? 'Unknown user'}</Text>
                <Text style={styles.username}>@{user?.username}</Text>
            </View>
            {tab === 'received' ? (item.status === 'pending' ? (<View style={styles.btnGroup}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRequest(item.id, 'accepted')}>
                    <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRequest(item.id, 'rejected')}>
                    <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
            </View>) : (<Text style={styles.statusText}>{statusLabel[item.status]}</Text>)) : (<Text style={styles.statusText}>{statusLabel[item.status]}</Text>)}
        </View>);
    };
    return (<View style={styles.container}>
        <View style={styles.tabRow}>
            {(['received', 'sent'] as const).map((t) => (<TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === 'received' ? 'Received' : 'Sent'}
                </Text>
            </TouchableOpacity>))}
        </View>

        {loading ? (<ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} />) : (<FlatList data={list} keyExtractor={(item) => String(item.id)} renderItem={renderItem} contentContainerStyle={list.length === 0 && styles.emptyList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />} ListEmptyComponent={<Text style={styles.emptyText}>No requests yet</Text>} />)}
    </View>);
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    tabRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: PRIMARY,
    },
    tabText: { fontSize: 15, color: '#999' },
    tabTextActive: { color: PRIMARY, fontWeight: '600' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
    },
    avatar: { width: 44, height: 44, borderRadius: 6 },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 6,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: { color: '#fff', fontSize: 18, fontWeight: '700' },
    info: { flex: 1, marginLeft: 12 },
    name: { fontSize: 15, color: '#333', fontWeight: '500' },
    username: { fontSize: 12, color: '#999', marginTop: 2 },
    btnGroup: { flexDirection: 'row', gap: 8 },
    acceptBtn: {
        backgroundColor: PRIMARY,
        borderRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    rejectBtn: {
        backgroundColor: '#E8E8E8',
        borderRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    rejectBtnText: { color: '#666', fontSize: 13 },
    statusText: { fontSize: 13, color: '#999' },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 14, color: '#999' },
});
