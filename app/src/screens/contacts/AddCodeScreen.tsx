import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    TextInput,
    Modal,
    FlatList,
    Image,
    Keyboard,
    Dimensions,
} from 'react-native';
import { friends, files } from '../../api';
import { User } from '../../types';

const PRIMARY = '#1277d6';
const { height: screenHeight } = Dimensions.get('window');
const UI_HEIGHT = screenHeight * 0.5;

interface SearchResult extends User {
    expireAt: number;
}

export default function AddCodeScreen() {
    // My code state
    const [myCode, setMyCode] = useState<number | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(30);

    // Search state
    const [searchingCode, setSearchingCode] = useState('');
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [searchResultCountdown, setSearchResultCountdown] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');

    // Dialog state
    const [showDialog, setShowDialog] = useState(false);

    // FlatList state (placeholder)
    const [listData, setListData] = useState<Array<{ id: number; title: string }>>([]);

    // Generate new code
    const getNewCode = useCallback(() => {
        friends
            .generateAddCode()
            .then((res: any) => {
                if (res.data?.success && res.data?.data) {
                    setMyCode(res.data.data.code);
                    setRemainingSeconds(30);
                }
            })
            .catch((err: any) => {
                console.error('Failed to generate add code:', err);
            });
    }, []);

    // Initialize and set up auto-refresh for my code
    useEffect(() => {
        getNewCode();
    }, [getNewCode]);

    // Timer for my code countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setRemainingSeconds((prev) => {
                if (prev <= 1) {
                    getNewCode();
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [getNewCode]);

    // Timer for search result countdown
    useEffect(() => {
        if (!searchResult) return;

        const interval = setInterval(() => {
            setSearchResultCountdown((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [searchResult]);

    // Verify code
    const handleFindCode = useCallback(() => {
        if (!searchingCode) {
            setSearchError('Please enter a code');
            return;
        }

        if (!/^\d{8}$/.test(searchingCode)) {
            setSearchError('Code must be 8 digits');
            return;
        }

        setIsSearching(true);
        setSearchError('');
        setSearchResult(null);

        friends
            .verifyAddCode(parseInt(searchingCode))
            .then((res: any) => {
                if (res.data?.success && res.data?.data) {
                    const result = res.data.data as SearchResult;
                    setSearchResult(result);
                    const secondsRemaining = Math.max(
                        0,
                        Math.ceil((result.expireAt - Date.now()) / 1000)
                    );
                    setSearchResultCountdown(secondsRemaining);
                    setShowDialog(true);
                }
            })
            .catch((err: any) => {
                console.error('Failed to verify code:', err);
                setSearchError('Invalid code or code has expired');
            })
            .finally(() => setIsSearching(false));
    }, [searchingCode]);

    // Send friend request
    const handleSendFriendRequest = useCallback(async () => {
        if (!searchResult) return;

        setIsSearching(true);

        try {
            const res = await friends.sendFriendRequestWithCode(
                parseInt(searchingCode),
                searchResult.id
            );
            if (res.data?.success) {
                Alert.alert('Success', 'Friend request sent!');
                setSearchResult(null);
                setSearchingCode('');
                setSearchError('');
                setShowDialog(false);
                Keyboard.dismiss();
            }
        } catch (err: any) {
            console.error('Failed to send friend request:', err);
            Alert.alert('Error', 'Failed to send friend request');
        } finally {
            setIsSearching(false);
        }
    }, [searchResult, searchingCode]);

    const handleDialogClose = useCallback(() => {
        setShowDialog(false);
    }, []);

    const renderAvatar = (user?: User) => {
        if (!user)
            return (
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>?</Text>
                </View>
            );

        if (user.avatar_locator) {
            return (
                <Image
                    source={files.getFileSource(user.avatar_locator)}
                    style={styles.dialogAvatar}
                />
            );
        }

        const letter = (user.display_name || '?')[0].toUpperCase();
        return (
            <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{letter}</Text>
            </View>
        );
    };

    const renderFlatListItem = ({ item }: { item: (typeof listData)[number] }) => (
        <View style={styles.flatListItem}>
            <Text style={styles.flatListItemText}>{item.title}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Upper Half - UI */}
            <View style={[styles.upperHalf, { height: UI_HEIGHT }]}>
                <View style={styles.section}>
                    {/* My Code Section */}
                    <Text style={styles.sectionTitle}>Your Code</Text>
                    <Text style={styles.sectionDesc}>
                        Click to refresh manually. Code expires in 30 seconds.
                    </Text>

                    <TouchableOpacity
                        style={styles.codeDisplay}
                        onPress={() => getNewCode()}
                        activeOpacity={0.7}
                    >
                        <View style={styles.codeBox}>
                            <Text style={styles.codeText}>
                                {myCode?.toString().padStart(8, '0') ?? '--------'}
                            </Text>
                        </View>
                        <View style={styles.codeProgressBar}>
                            {myCode?.toString().padStart(8, '0') && (
                                <View
                                    style={[
                                        styles.codeProgressFill,
                                        {
                                            width: `${(remainingSeconds / 30) * 100}%`,
                                        },
                                    ]}
                                />
                            )}
                        </View>
                    </TouchableOpacity>

                    <Text style={styles.countdownText}>
                        {remainingSeconds}s remaining
                    </Text>
                </View>

                {/* Search Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Find Others Code</Text>
                    <Text style={styles.sectionDesc}>
                        Input the 8-digit code they provide
                    </Text>

                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.codeInput}
                            placeholder="8-digit code"
                            placeholderTextColor="#999"
                            value={searchingCode}
                            onChangeText={setSearchingCode}
                            keyboardType="number-pad"
                            maxLength={8}
                            editable={!isSearching}
                            onSubmitEditing={handleFindCode}
                        />
                        <TouchableOpacity
                            style={[
                                styles.findBtn,
                                isSearching && styles.findBtnDisabled,
                            ]}
                            onPress={handleFindCode}
                            disabled={isSearching}
                            activeOpacity={0.6}
                        >
                            {isSearching ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                />
                            ) : (
                                <Text style={styles.findBtnText}>Find</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {searchError ? (
                        <Text style={styles.errorText}>{searchError}</Text>
                    ) : null}
                </View>
            </View>

            {/* Lower Half - FlatList */}
            <View style={[styles.lowerHalf, { height: screenHeight - UI_HEIGHT }]}>
                <FlatList
                    data={listData}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderFlatListItem}
                    ListEmptyComponent={
                        <View style={styles.emptyListContainer}>
                            <Text style={styles.emptyListText}>
                                No data yet
                            </Text>
                        </View>
                    }
                    scrollEnabled={true}
                />
            </View>

            {/* Result Dialog */}
            <Modal
                visible={showDialog}
                transparent={true}
                animationType="fade"
                onRequestClose={handleDialogClose}
            >
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContent}>
                        <View style={styles.dialogHeader}>
                            <Text style={styles.dialogTitle}>Confirm User</Text>
                            <TouchableOpacity
                                onPress={handleDialogClose}
                                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                            >
                                <Text style={styles.dialogCloseBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {searchResult ? (
                            <>
                                {/* User Info */}
                                <View style={styles.userInfoContainer}>
                                    {renderAvatar(searchResult)}
                                    <View style={styles.userInfoText}>
                                        <Text style={styles.userName}>
                                            {searchResult.display_name ||
                                                searchResult.username}
                                        </Text>
                                        <Text style={styles.userUsername}>
                                            @{searchResult.username}
                                        </Text>
                                    </View>
                                    {searchResultCountdown > 0 ? (
                                        <Text style={styles.countdownBadge}>
                                            {searchResultCountdown}s
                                        </Text>
                                    ) : (
                                        <Text style={styles.expiredBadge}>
                                            expired
                                        </Text>
                                    )}
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.dialogButtons}>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={handleDialogClose}
                                        disabled={isSearching}
                                    >
                                        <Text style={styles.cancelBtnText}>
                                            Cancel
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.addBtn,
                                            (isSearching ||
                                                searchResultCountdown <= 0) &&
                                            styles.addBtnDisabled,
                                        ]}
                                        onPress={handleSendFriendRequest}
                                        disabled={
                                            isSearching ||
                                            searchResultCountdown <= 0
                                        }
                                    >
                                        {isSearching ? (
                                            <ActivityIndicator
                                                size="small"
                                                color="#fff"
                                            />
                                        ) : (
                                            <Text style={styles.addBtnText}>
                                                Send Request
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    upperHalf: {
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
        overflow: 'hidden',
    },
    lowerHalf: {
        backgroundColor: '#F5F5F5',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E5E5',
    },
    section: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    sectionDesc: {
        fontSize: 12,
        color: '#999',
        marginBottom: 12,
    },
    codeDisplay: {
        marginBottom: 8,
    },
    codeBox: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        paddingVertical: 16,
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    codeText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1277d6',
        fontFamily: 'monospace',
    },
    codeProgressBar: {
        height: 4,
        backgroundColor: '#E5E5E5',
        borderRadius: 2,
        overflow: 'hidden',
    },
    codeProgressFill: {
        height: '100%',
        backgroundColor: '#1277d6',
    },
    countdownText: {
        fontSize: 11,
        color: '#999',
        textAlign: 'center',
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    codeInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#333',
        backgroundColor: '#fafafa',
    },
    findBtn: {
        backgroundColor: PRIMARY,
        borderRadius: 6,
        paddingHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 60,
    },
    findBtnDisabled: {
        opacity: 0.5,
    },
    findBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 12,
        color: '#e74c3c',
        marginTop: 4,
    },
    // FlatList
    flatListItem: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        marginHorizontal: 8,
        marginVertical: 4,
        borderRadius: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
    },
    flatListItemText: {
        fontSize: 14,
        color: '#333',
    },
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyListText: {
        fontSize: 14,
        color: '#999',
    },
    // Dialog
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dialogContent: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        maxHeight: '80%',
    },
    dialogHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    dialogTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    dialogCloseBtn: {
        fontSize: 20,
        color: '#999',
        fontWeight: '300',
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 0,
        marginBottom: 16,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        // paddingHorizontal: 12,
    },
    dialogAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    userInfoText: {
        flex: 1,
    },
    userName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    userUsername: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    countdownBadge: {
        fontSize: 11,
        color: '#999',
        fontFamily: 'monospace',
    },
    expiredBadge: {
        fontSize: 11,
        color: '#e74c3c',
        fontWeight: '600',
    },
    dialogButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#E8E8E8',
        borderRadius: 6,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    addBtn: {
        flex: 1,
        backgroundColor: PRIMARY,
        borderRadius: 6,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addBtnDisabled: {
        opacity: 0.5,
    },
    addBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});
