import React, { useState, useCallback, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { conversations, files } from '../../api';
import { Conversation } from '../../types';
import { onMessage, onMessageRecalled, onMessageReadAck, setOnReconnect } from '../../services/socket';
import { NavMethods } from '../../navigation';
const PRIMARY = '#1277d6';
const ConversationListScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [list, setList] = useState<Conversation[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const loadConversations = useCallback(async () => {
        try {
            const res = await conversations.getConversations();
            setList(res.data.data || []);
        }
        catch (_) {
        }
        finally {
            setInitialLoading(false);
        }
    }, []);
    useFocusEffect(useCallback(() => {
        loadConversations();
    }, [loadConversations]));
    useEffect(() => {
        setInterval(() => {
            loadConversations();
        }, 1000);
    }, []);
    useEffect(() => {
        const offMessage = onMessage(() => loadConversations());
        const offRecalled = onMessageRecalled(() => loadConversations());
        const offReadAck = onMessageReadAck(() => loadConversations());
        setOnReconnect(() => loadConversations());
        return () => {
            offMessage();
            offRecalled();
            offReadAck();
        };
    }, [loadConversations]);
    const onRefresh = async () => {
        setRefreshing(true);
        await loadConversations();
        setRefreshing(false);
    };
    const formatTime = (ts: string) => {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();
        if (isToday) {
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };
    const getPreview = (item: Conversation): string => {
        const msg = item.lastMessage;
        if (!msg)
            return '';
        if (msg.is_recalled)
            return 'Message recalled';
        switch (msg.type) {
            case 'image':
                return '[Image]';
            case 'video':
                return '[Video]';
            case 'file':
                return '[File]';
            default:
                return msg.content || '';
        }
    };

    const upd = useContext(NavMethods);
    const renderItem = ({ item }: {
        item: Conversation;
    }) => {
        const peer = item.peer;
        const peerName = peer?.display_name || peer?.username || '?';
        const initial = peerName[0].toUpperCase();
        return (
            <TouchableOpacity style={styles.itemCard} activeOpacity={0.7}
                onPress={
                    () => {
                        navigation.navigate('Chat', {
                            peerId: item.peer_id,
                            peerName,
                            peerAvatar: peer?.avatar_locator ?? null,
                        });

                        if (upd.fetchBadge)
                            upd.fetchBadge();
                    }
                }
            >
                <View style={styles.avatarContainer}>
                    {peer?.avatar_locator ? (<Image source={files.getFileSource(peer.avatar_locator)} style={styles.avatarImg} />) : (<View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{initial}</Text>
                    </View>)}
                    {item.unread_count > 0 && (<View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                            {item.unread_count > 99 ? '99+' : item.unread_count}
                        </Text>
                    </View>)}
                </View>

                <View style={styles.content}>
                    <View style={styles.topRow}>
                        <Text style={styles.name} numberOfLines={1}>
                            {peerName}
                        </Text>
                        {item.lastMessage && (<Text style={styles.time}>
                            {formatTime(item.lastMessage.created_at as unknown as string)}
                        </Text>)}
                    </View>
                    <View style={styles.bottomRow}>
                        <Text style={styles.preview} numberOfLines={1}>
                            {getPreview(item)}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (<SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Messages</Text>
            <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('UserSearch')} activeOpacity={0.6}>
                <Ionicons name="search" size={20} color="#1F2937" />
            </TouchableOpacity>
        </View>

        {
            initialLoading ?
                (<View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                </View>) :
                (<FlatList data={list} keyExtractor={(item) => String(item.peer_id)}
                    renderItem={renderItem}
                    contentContainerStyle={[styles.listContent, list.length === 0 && styles.emptyContainer]}
                    showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" style={{ marginBottom: 16 }} />
                            <Text style={styles.emptyText}>No new messages</Text>
                            <Text style={styles.emptySubText}>Start a conversation with a friend</Text>
                        </View>
                    }
                />)
        }
    </SafeAreaView>);
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#ffffff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#111827',
    },
    searchButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 0,
        paddingBottom: 40,
    },
    emptyContainer: {
        flex: 1,
        paddingTop: 0,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F3F4F6',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatarPlaceholder: {
        width: 54,
        height: 54,
        borderRadius: 16,
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImg: {
        width: 54,
        height: 54,
        borderRadius: 16,
    },
    avatarText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
    },
    unreadBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        borderRadius: 12,
        minWidth: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    unreadText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    name: {
        fontSize: 17,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        marginRight: 8,
    },
    time: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    preview: {
        fontSize: 14,
        color: '#6B7280',
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
export default ConversationListScreen;
