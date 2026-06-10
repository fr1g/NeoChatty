import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    ScrollView,
    RefreshControl,
} from 'react-native';
import { friends, files } from '../../api';
import { User } from '../../types';
import { useBleBroadcast, DiscoveredFriend } from '../../hooks/useBleBroadcast';
import { useAuth } from '../../context/AuthContext';
import AntDesign from '@expo/vector-icons/build/AntDesign';

const PRIMARY = '#1277d6';

interface SearchResult extends User {
    expireAt: number;
}

interface FlatListItem extends DiscoveredFriend {
    userInfo: {
        id: number;
        username: string;
        display_name: string;
        avatar_locator?: string;
    };
}

export default function AddCodeScreen() {
    const { user } = useAuth();
    const userId = user?.id;


    // My code state
    const [myCode, setMyCode] = useState<number | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(30);
    const [myCodeExpireAt, setMyCodeExpireAt] = useState<number>(0);


    // Search (manual code input) state
    const [searchingCode, setSearchingCode] = useState('');
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [searchResultCountdown, setSearchResultCountdown] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');


    // BLE nearby discovery state
    const [bleEnabled, setBleEnabled] = useState(true);
    const {
        isLoading: bleLoading,
        error: bleError,
        isBle5Supported,
        isBleActuallyAvailable,
        hasBluetoothPermission,
        discoveredFriends,
        refreshFriends,
        requestPermissions: requestBlePermissions,
    } = useBleBroadcast({
        enabled: bleEnabled && !!userId && !!myCode,
        userId: userId || 0,
        addCode: myCode || 0,
        expirationTimestamp: myCodeExpireAt,
    });

    // Nearby user detail dialog state
    const [selectedFriend, setSelectedFriend] = useState<FlatListItem | null>(null);
    const [isSendingRequest, setIsSendingRequest] = useState(false);

    // Generate new code
    const getNewCode = useCallback(() => {
        friends
            .generateAddCode()
            .then((res: any) => {
                if (res.data?.success && res.data?.data) {
                    setMyCode(res.data.data.code);
                    setMyCodeExpireAt(res.data.data.expireAt);
                    setRemainingSeconds(30);
                }
            })
            .catch((err: any) => {
                console.error('Failed to generate add code:', err);
            });
    }, []);

    // Timer: my code countdown
    useEffect(() => {
        getNewCode();
    }, [getNewCode]);

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

    // Timer: manual search result countdown
    useEffect(() => {
        if (!searchResult) return;
        const interval = setInterval(() => {
            setSearchResultCountdown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [searchResult]);

    // Timer: nearby friend detail dialog countdown (removed — expirationTimestamp is no longer in payload)

    // Screen blur → disable BLE
    useEffect(() => {
        return () => {
            setBleEnabled(false);
        };
    }, []);

    // Manual code search
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
                        Math.ceil((result.expireAt - Date.now()) / 1000),
                    );
                    setSearchResultCountdown(secondsRemaining);
                }
            })
            .catch((err: any) => {
                console.error('Failed to verify code:', err);
                setSearchError('Invalid code or code has expired');
            })
            .finally(() => setIsSearching(false));
    }, [searchingCode]);

    // Send friend request (manual code flow)
    const handleSendFriendRequest = useCallback(async () => {
        if (!searchResult) return;
        setIsSearching(true);
        try {
            const res = await friends.sendFriendRequestWithCode(
                parseInt(searchingCode),
                searchResult.id,
            );
            if (res.data?.success) {
                Alert.alert('Success', 'Friend request sent!');
                setSearchResult(null);
                setSearchingCode('');
                setSearchError('');
                Keyboard.dismiss();
            }
        } catch (err: any) {
            console.error('Failed to send friend request:', err);
            Alert.alert('Error', 'Failed to send friend request');
        } finally {
            setIsSearching(false);
        }
    }, [searchResult, searchingCode]);

    // Send friend request (BLE nearby flow)
    const handleSendNearbyFriendRequest = useCallback(async () => {
        if (!selectedFriend || !selectedFriend.userInfo) return;

        setIsSendingRequest(true);
        try {
            const res = await friends.sendFriendRequestWithCode(
                selectedFriend.addCode,
                selectedFriend.userInfo.id,
            );
            if (res.data?.success) {
                Alert.alert('Success', 'Friend request sent!');
                setSelectedFriend(null);
            }
        } catch (err: any) {
            console.error('Failed to send friend request:', err);
            Alert.alert('Error', 'Failed to send friend request');
        } finally {
            setIsSendingRequest(false);
        }
    }, [selectedFriend]);

    // Load user info for discovered friends
    const [discoveredFriendsWithInfo, setDiscoveredFriendsWithInfo] = useState<FlatListItem[]>([]);
    const loadingFriendsMapRef = React.useRef<Map<string, boolean>>(new Map());

    useEffect(() => {
        discoveredFriends.forEach((friend) => {
            // Skip if already loading or already has userInfo
            if (loadingFriendsMapRef.current.get(friend.deviceId)) return;

            const existing = discoveredFriendsWithInfo.find(
                (f) => f.deviceId === friend.deviceId && f.userInfo,
            );
            if (existing) return;

            // Mark as loading
            loadingFriendsMapRef.current.set(friend.deviceId, true);

            friends
                .verifyAddCode(friend.addCode)
                .then((res: any) => {
                    if (res.data?.success && res.data?.data) {
                        const userData = res.data.data;

                        // Verify userId matches the broadcast source
                        if (userData.id !== friend.userId) {
                            return; // userId mismatch, skip
                        }

                        setDiscoveredFriendsWithInfo((prev) => {
                            const exists = prev.find(
                                (f) => f.deviceId === friend.deviceId,
                            );
                            if (exists && exists.userInfo) return prev;

                            const updated: FlatListItem = {
                                ...friend,
                                userInfo: {
                                    id: userData.id,
                                    username: userData.username,
                                    display_name: userData.display_name,
                                    avatar_locator: userData.avatar_locator,
                                },
                            };
                            if (exists) {
                                return prev.map((f) =>
                                    f.deviceId === friend.deviceId ? updated : f,
                                );
                            }
                            return [...prev, updated];
                        });
                    }
                })
                .catch((err: any) => {
                    console.error(
                        'Failed to fetch friend info for addCode:',
                        friend.addCode,
                        err,
                    );
                })
                .finally(() => {
                    loadingFriendsMapRef.current.delete(friend.deviceId);
                });
        });

        // Also update the list with newly discovered friends (even without userInfo yet)
        setDiscoveredFriendsWithInfo((prev) => {
            let changed = false;
            const next = [...prev];
            discoveredFriends.forEach((friend) => {
                if (!next.find((f) => f.deviceId === friend.deviceId)) {
                    next.push(friend as FlatListItem);
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [discoveredFriends]);

    // Filter: only friends with userInfo, exclude self
    const filteredFriends = useMemo(() => {
        return discoveredFriendsWithInfo.filter(
            (f) => f.userInfo && f.userInfo.id !== userId,
        );
    }, [discoveredFriendsWithInfo, userId]);

    // Render helpers
    const renderAvatar = (avatarLocator?: string, displayName?: string) => {
        if (avatarLocator) {
            return (
                <Image
                    source={files.getFileSource(avatarLocator)}
                    style={styles.avatarSmall}
                />
            );
        }
        const letter = (displayName || '?')[0].toUpperCase();
        return (
            <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{letter}</Text>
            </View>
        );
    };

    const renderDialogAvatar = (avatarLocator?: string, displayName?: string) => {
        if (avatarLocator) {
            return (
                <Image
                    source={files.getFileSource(avatarLocator)}
                    style={styles.dialogAvatar}
                />
            );
        }
        const letter = (displayName || '?')[0].toUpperCase();
        return (
            <View style={styles.dialogAvatarPlaceholder}>
                <Text style={styles.dialogAvatarLetter}>{letter}</Text>
            </View>
        );
    };


    // FlatList item

    const renderFlatListItem = ({ item }: { item: FlatListItem }) => {
        if (!item.userInfo) return null;

        return (
            <TouchableOpacity
                style={styles.flatListItem}
                onPress={() => {
                    setSelectedFriend(item);
                }}
                activeOpacity={0.6}
            >
                <View style={styles.discoveredFriendHeader}>
                    {renderAvatar(
                        item.userInfo.avatar_locator,
                        item.userInfo.display_name,
                    )}
                    <View style={styles.discoveredFriendInfo}>
                        <Text style={styles.discoveredFriendName}>
                            {item.userInfo.display_name || item.userInfo.username}
                        </Text>
                        <Text style={styles.discoveredFriendUsername}>
                            @{item.userInfo.username}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };


    // Bluetooth status banner

    const renderBluetoothStatus = () => {
        if (!isBle5Supported) {
            return (
                <View style={styles.bleStatusContainer}>
                    <Text style={styles.bleStatusError}>
                        This device doesn't support BLE 5.0
                    </Text>
                </View>
            );
        }

        // Emulators and devices without actual Bluetooth hardware
        if (!isBleActuallyAvailable) {
            return (
                <View style={styles.bleStatusContainer}>
                    <Text style={styles.bleStatusError}>
                        Bluetooth is not available, please make sure you have enabled your Bluetooth on your device,
                        and refresh to try again. Nearby user
                        discovery requires a real device with Bluetooth
                        hardware.
                    </Text>
                </View>
            );
        }

        if (!hasBluetoothPermission) {
            return (
                <View style={styles.bleStatusContainer}>
                    <Text style={styles.bleStatusError}>
                        Bluetooth permission required
                    </Text>
                    <TouchableOpacity
                        style={styles.permissionBtn}
                        onPress={requestBlePermissions}
                    >
                        <Text style={styles.permissionBtnText}>Grant</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (bleError) {
            return (
                <View style={styles.bleStatusContainer}>
                    <Text style={styles.bleStatusError}>{bleError}</Text>
                </View>
            );
        }

        return null;
    };


    // Main render

    return (
        <View style={styles.container}>
            {/* Upper: Code & Search (natural height) */}
            <ScrollView
                style={styles.upperHalf}
                contentContainerStyle={styles.upperHalfContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* My Code Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Code</Text>
                    <Text style={styles.sectionDesc}>
                        Tap to refresh. Code expires in 30 seconds.
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
                            {myCode && (
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
                    <Text style={styles.sectionTitle}>Find by Code</Text>
                    <Text style={styles.sectionDesc}>
                        Enter an 8-digit code
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
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.findBtnText}>Find</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {searchError ? (
                        <Text style={styles.errorText}>{searchError}</Text>
                    ) : null}
                </View>
            </ScrollView>

            {/* Lower: Nearby Users (flex: 1 takes remaining space) */}
            <View style={styles.lowerHalf}>
                {renderBluetoothStatus()}

                {/* Header */}
                <View style={styles.lowerHalfHeader}>
                    <Text style={styles.lowerHalfTitle}>
                        Nearby Users ({filteredFriends.length})
                    </Text>
                    <TouchableOpacity
                        onPress={refreshFriends}
                        disabled={
                            bleLoading || !isBle5Supported || !isBleActuallyAvailable || !hasBluetoothPermission
                        }
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        {bleLoading ? (
                            <ActivityIndicator size="small" color={PRIMARY} />
                        ) : (
                            <AntDesign name="reload" size={24} color="black" style={styles.refreshIcon} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Friends List */}
                <FlatList
                    data={filteredFriends}
                    keyExtractor={(item) => item.deviceId}
                    renderItem={renderFlatListItem}
                    ListEmptyComponent={
                        <View style={styles.emptyListContainer}>
                            <Text style={styles.emptyListText}>
                                {!isBle5Supported
                                    ? 'BLE 5.0 required'
                                    : !isBleActuallyAvailable
                                        ? 'Bluetooth not available on this device'
                                        : !hasBluetoothPermission
                                            ? 'Grant Bluetooth permission to discover nearby users'
                                            : 'No nearby users found'}
                            </Text>
                        </View>
                    }
                    scrollEnabled={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={bleLoading}
                            onRefresh={refreshFriends}
                        />
                    }
                />
            </View>

            {/* Manual Search Result Dialog (unchanged) */}
            <Modal
                visible={!!searchResult}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSearchResult(null)}
            >
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContent}>
                        <View style={styles.dialogHeader}>
                            <Text style={styles.dialogTitle}>Confirm User</Text>
                            <TouchableOpacity
                                onPress={() => setSearchResult(null)}
                                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                            >
                                <Text style={styles.dialogCloseBtn}>{'\u2715'}</Text>
                            </TouchableOpacity>
                        </View>

                        {searchResult && (
                            <>
                                <View style={styles.userInfoContainer}>
                                    {renderDialogAvatar(
                                        searchResult.avatar_locator || undefined,
                                        searchResult.display_name,
                                    )}
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

                                <View style={styles.dialogButtons}>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={() => setSearchResult(null)}
                                        disabled={isSearching}
                                    >
                                        <Text style={styles.cancelBtnText}>
                                            Cancel
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.addBtn,
                                            (isSearching || searchResultCountdown <= 0) &&
                                            styles.addBtnDisabled,
                                        ]}
                                        onPress={handleSendFriendRequest}
                                        disabled={
                                            isSearching || searchResultCountdown <= 0
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
                        )}
                    </View>
                </View>
            </Modal>

            {/* Nearby Friend Detail Dialog */}
            <Modal
                visible={!!selectedFriend}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedFriend(null)}
            >
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContent}>
                        <View style={styles.dialogHeader}>
                            <Text style={styles.dialogTitle}>Nearby User</Text>
                            <TouchableOpacity
                                onPress={() => setSelectedFriend(null)}
                                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                            >
                                <Text style={styles.dialogCloseBtn}>{'\u2715'}</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedFriend && selectedFriend.userInfo && (
                            <>
                                {/* User Info Card */}
                                <View style={styles.userInfoContainer}>
                                    {renderDialogAvatar(
                                        selectedFriend.userInfo.avatar_locator,
                                        selectedFriend.userInfo.display_name,
                                    )}
                                    <View style={styles.userInfoText}>
                                        <Text style={styles.userName}>
                                            {selectedFriend.userInfo.display_name ||
                                                selectedFriend.userInfo.username}
                                        </Text>
                                        <Text style={styles.userUsername}>
                                            @{selectedFriend.userInfo.username}
                                        </Text>
                                        <Text style={styles.userDetailRow}>
                                            ID: {selectedFriend.userInfo.id}
                                        </Text>
                                    </View>

                                </View>

                                {/* Device info */}
                                <View style={styles.deviceInfoRow}>
                                    <Text style={styles.deviceInfoLabel}>
                                        Add Code:{' '}
                                    </Text>
                                    <Text style={styles.deviceInfoValue}>
                                        {selectedFriend.addCode
                                            .toString()
                                            .padStart(8, '0')}
                                    </Text>
                                </View>
                                <View style={styles.deviceInfoRow}>
                                    <Text style={styles.deviceInfoLabel}>
                                        Device:{' '}
                                    </Text>
                                    <Text style={styles.deviceInfoValue}>
                                        {selectedFriend.deviceName ||
                                            selectedFriend.deviceId}
                                    </Text>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.dialogButtons}>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={() => setSelectedFriend(null)}
                                        disabled={isSendingRequest}
                                    >
                                        <Text style={styles.cancelBtnText}>
                                            Cancel
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.addBtn,
                                            isSendingRequest && styles.addBtnDisabled,
                                        ]}
                                        onPress={handleSendNearbyFriendRequest}
                                        disabled={isSendingRequest}
                                    >
                                        {isSendingRequest ? (
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
                        )}
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
        flexGrow: 0,
        flexShrink: 0,
    },
    upperHalfContent: {
        paddingBottom: 8,
    },
    lowerHalf: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E5E5',
        flexDirection: 'column',
    },
    lowerHalfHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
    },
    lowerHalfTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    refreshIcon: {
        fontSize: 18,
    },
    bleStatusContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF3CD',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#FFE69C',
    },
    bleStatusError: {
        fontSize: 13,
        color: '#856404',
        fontWeight: '500',
        marginBottom: 8,
    },
    permissionBtn: {
        backgroundColor: PRIMARY,
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
    },
    permissionBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
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
    // FlatList items
    flatListItem: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#fff',
        marginHorizontal: 8,
        marginVertical: 4,
        borderRadius: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
    },
    discoveredFriendHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    discoveredFriendInfo: {
        flex: 1,
    },
    discoveredFriendName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    discoveredFriendUsername: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    discoveredFriendCountdown: {
        fontSize: 11,
        color: '#999',
        fontFamily: 'monospace',
    },
    discoveredFriendExpired: {
        fontSize: 11,
        color: '#e74c3c',
        fontWeight: '600',
    },
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
    },
    emptyListText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    // Small avatar for list item
    avatarSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    // Dialog shared
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
        paddingHorizontal: 8,
        marginBottom: 16,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
    },
    dialogAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        marginRight: 12,
    },
    dialogAvatarPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    dialogAvatarLetter: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
    },
    userInfoText: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    userUsername: {
        fontSize: 13,
        color: '#999',
        marginTop: 2,
    },
    userDetailRow: {
        fontSize: 12,
        color: '#aaa',
        marginTop: 4,
    },
    countdownBadge: {
        fontSize: 13,
        color: '#999',
        fontFamily: 'monospace',
        marginLeft: 8,
    },
    expiredBadge: {
        fontSize: 13,
        color: '#e74c3c',
        fontWeight: '600',
        marginLeft: 8,
    },
    // Device info in nearby dialog
    deviceInfoRow: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    deviceInfoLabel: {
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
    },
    deviceInfoValue: {
        fontSize: 13,
        color: '#333',
    },
    // Buttons
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
