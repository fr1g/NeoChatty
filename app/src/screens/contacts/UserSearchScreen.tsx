import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { users, files } from '../../api';
import { UserProfile } from '../../types';
type Nav = NativeStackNavigationProp<RootStackParamList>;
const PRIMARY = '#1277d6';
const PAGE_SIZE = 20;
export default function UserSearchScreen() {
    const navigation = useNavigation<Nav>();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searched, setSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            setSearched(false);
            setPage(1);
            setTotal(0);
            return;
        }
        setLoading(true);
        setSearched(true);
        try {
            const res = await users.searchUsers(q.trim(), 1, PAGE_SIZE);
            const data = res.data.data;
            setResults(data?.users ?? []);
            setTotal(data?.total ?? 0);
            setPage(1);
        }
        catch {
            Alert.alert('Error', 'Search failed');
        }
        finally {
            setLoading(false);
        }
    }, []);
    const loadMore = useCallback(async () => {
        if (loadingMore || !query.trim())
            return;
        const nextPage = page + 1;
        setLoadingMore(true);
        try {
            const res = await users.searchUsers(query.trim(), nextPage, PAGE_SIZE);
            const data = res.data.data;
            setResults((prev) => [...prev, ...(data?.users ?? [])]);
            setTotal(data?.total ?? 0);
            setPage(nextPage);
        }
        catch {
            Alert.alert('Error', 'Failed to load more results');
        }
        finally {
            setLoadingMore(false);
        }
    }, [loadingMore, query, page]);
    const hasMore = results.length < total;
    const onChangeText = (text: string) => {
        setQuery(text);
        if (timerRef.current)
            clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => doSearch(text), 300);
    };
    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setSearched(false);
        setPage(1);
        setTotal(0);
        if (timerRef.current)
            clearTimeout(timerRef.current);
    };
    const renderAvatar = (user: UserProfile) => {
        if (user.avatar_locator) {
            return <Image source={files.getFileSource(user.avatar_locator)} style={styles.avatarImg} />;
        }
        const letter = (user.display_name || user.username || '?')[0].toUpperCase();
        return (<View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>{letter}</Text>
        </View>);
    };
    const renderItem = ({ item }: {
        item: UserProfile;
    }) => (<TouchableOpacity style={styles.resultCard} activeOpacity={0.7} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
        {renderAvatar(item)}
        <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
            <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
    </TouchableOpacity>);
    return (<View style={styles.container}>

        <View style={styles.headerArea}>
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput style={styles.input} placeholder="Search for new friends" placeholderTextColor="#9CA3AF" value={query} onChangeText={onChangeText} autoFocus returnKeyType="search" autoCapitalize="none" />
                {query.length > 0 && (<TouchableOpacity onPress={clearSearch} style={styles.clearBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={18} color="#D1D5DB" />
                </TouchableOpacity>)}
            </View>
        </View>


        {loading ? (<ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} size="large" />) : (<FlatList data={results} keyExtractor={(item) => String(item.id)} renderItem={renderItem} contentContainerStyle={[styles.listContent, results.length === 0 && styles.emptyContainer]} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.emptyWrap}>
            <Ionicons name="search-outline" size={64} color="#E5E7EB" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>
                {searched ? 'No matching users found' : 'Enter a Chatty ID or display name to search'}
            </Text>
        </View>} ListFooterComponent={hasMore ? (<TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore} activeOpacity={0.7}>
            {loadingMore ? (<ActivityIndicator color={PRIMARY} size="small" />) : (<Text style={styles.loadMoreText}>Load more</Text>)}
        </TouchableOpacity>) : null} />)}
    </View>);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6'
    },
    headerArea: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
        zIndex: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
        height: '100%',
    },
    clearBtn: {
        marginLeft: 8,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingTop: 0,
    },
    resultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    avatarImg: {
        width: 48,
        height: 48,
        borderRadius: 14,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
    },
    info: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '600',
        marginBottom: 2,
    },
    username: {
        fontSize: 13,
        color: '#6B7280',
    },
    emptyWrap: {
        alignItems: 'center',
        marginTop: -80,
    },
    emptyText: {
        fontSize: 15,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    loadMoreBtn: {
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: 'transparent',
        marginTop: 8,
    },
    loadMoreText: {
        fontSize: 14,
        color: PRIMARY,
        fontWeight: '600',
    },
});
