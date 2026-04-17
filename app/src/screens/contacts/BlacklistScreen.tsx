import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, RefreshControl, } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { blocks, files } from '../../api';
import { User } from '../../types';
const PRIMARY = '#1277d6';
export default function BlacklistScreen() {
    const [list, setList] = useState<User[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const loadBlocks = useCallback(async () => {
        try {
            const res = await blocks.getBlocks();
            const blockList = res.data.data ?? [];
            setList(blockList.map((b: any) => b.blockedUser ?? b));
        }
        catch {
            Alert.alert('Error', 'Failed to load blocklist');
        }
        finally {
            setInitialLoading(false);
        }
    }, []);
    useFocusEffect(useCallback(() => {
        loadBlocks();
    }, [loadBlocks]));
    const onRefresh = async () => {
        setRefreshing(true);
        await loadBlocks();
        setRefreshing(false);
    };
    const confirmUnblock = (userId: number, name: string) => {
        Alert.alert('Confirm', `Remove "${name}" from the blocklist?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Unblock',
                onPress: async () => {
                    try {
                        await blocks.unblockUser(userId);
                        setList((prev) => prev.filter((u) => u.id !== userId));
                    }
                    catch {
                        Alert.alert('Error', 'Failed to unblock user');
                    }
                },
            },
        ]);
    };
    const renderAvatar = (user: User) => {
        if (user.avatar_locator) {
            return <Image source={files.getFileSource(user.avatar_locator)} style={styles.avatar} />;
        }
        const letter = (user.display_name || '?')[0].toUpperCase();
        return (<View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>{letter}</Text>
        </View>);
    };
    const renderItem = ({ item }: {
        item: User;
    }) => (<View style={styles.row}>
        {renderAvatar(item)}
        <Text style={styles.name}>{item.display_name}</Text>
        <TouchableOpacity style={styles.unblockBtn} onPress={() => confirmUnblock(item.id, item.display_name)}>
            <Text style={styles.unblockBtnText}>Unblock</Text>
        </TouchableOpacity>
    </View>);
    if (initialLoading) {
        return (<View style={[styles.container, styles.center]}>
            <ActivityIndicator size="large" color={PRIMARY} />
        </View>);
    }
    return (<View style={styles.container}>
        <FlatList data={list} keyExtractor={(item) => String(item.id)} renderItem={renderItem} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />} contentContainerStyle={list.length === 0 && styles.emptyList} ListEmptyComponent={<Text style={styles.emptyText}>Your blocklist is empty</Text>} />
    </View>);
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    center: { justifyContent: 'center', alignItems: 'center' },
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
        backgroundColor: '#999',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: { color: '#fff', fontSize: 18, fontWeight: '700' },
    name: { flex: 1, marginLeft: 12, fontSize: 15, color: '#333', fontWeight: '500' },
    unblockBtn: {
        borderWidth: 1,
        borderColor: PRIMARY,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    unblockBtnText: { color: PRIMARY, fontSize: 13, fontWeight: '500' },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 14, color: '#999' },
});
