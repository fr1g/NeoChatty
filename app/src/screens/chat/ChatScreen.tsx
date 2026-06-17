import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Dimensions, Linking, Share, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { messages as messagesApi, files } from '../../api';
import * as socketService from '../../services/socket';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File as FSFile, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getTokens } from '../../api/client';
import { getApiErrorMessage, inferMimeTypeFromName, normalizeUploadAsset, resolveUploadMimeType, } from '../../utils/upload';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
    id: number;
    sender_id: number;
    receiver_id: number;
    type: 'text' | 'image' | 'file' | 'video';
    content: string | null;
    file_locator?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    is_recalled?: boolean;
    created_at: string;
    _tempId?: number;
    _localUri?: string | null;
}

interface RouteParams {
    peerId: number;
    peerName: string;
    peerAvatar?: string | null;
}


const SCREEN_WIDTH = Dimensions.get('window').width;
const ChatScreen: React.FC = () => {

    const bottomSpace = useSafeAreaInsets().bottom;

    const route = useRoute();
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { peerId, peerName, peerAvatar } = route.params as RouteParams;
    const [list, setList] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [previewImageSource, setPreviewImageSource] = useState<{
        uri: string;
        headers?: Record<string, string>;
    } | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const tempIdCounter = useRef(Date.now());
    const mergeMessages = useCallback((messages: Message[]) => {
        const messageMap = new Map<number, Message>();
        messages.forEach((message) => {
            messageMap.set(message.id, message);
        });
        return [...messageMap.values()].sort((left, right) => left.id - right.id);
    }, []);
    const inferMimeType = useCallback((fileName: string, fallback: string) => {
        return inferMimeTypeFromName(fileName, fallback);
    }, []);
    useEffect(() => {
        navigation.setOptions({ title: peerName });
    }, [navigation, peerName]);
    const loadMessages = useCallback(async (before?: number) => {
        try {
            const res = await messagesApi.getMessages(peerId, before);
            const msgs: Message[] = res.data.data ?? [];
            if (msgs.length === 0) {
                setHasMore(false);
                return;
            }
            setList((prev) => mergeMessages(before ? [...msgs, ...prev] : msgs));
        }
        catch (_) {
            if (!before)
                Alert.alert('Notice', 'Failed to load messages');
        }
        finally {
            if (!before)
                setInitialLoad(false);
        }
    }, [peerId]);
    useEffect(() => {
        loadMessages();
        socketService.markAsRead(peerId);
        const offMsg = socketService.onMessage((msg: Message) => {
            if (msg.sender_id === peerId || msg.receiver_id === peerId) {
                setList((prev) => mergeMessages([...prev, msg]));
                socketService.markAsRead(peerId);
            }
        });
        const offRecall = socketService.onMessageRecalled((data: {
            message_id: number;
        }) => {
            setList((prev) => prev.map((m) => m.id === data.message_id ? { ...m, is_recalled: true } : m));
        });
        const offAck = socketService.onMessageAck((data: {
            id: number;
            created_at: string;
            temp_id?: number;
        }) => {
            setList((prev) => prev.map((m) => m._tempId && m._tempId === data.temp_id
                ? { ...m, id: data.id, created_at: data.created_at, _tempId: undefined }
                : m));
        });
        const offError = socketService.onMessageError((data: {
            reason: string;
        }) => {
            Alert.alert('Send Failed', data.reason);
        });
        return () => {
            offMsg();
            offRecall();
            offAck();
            offError();
        };
    }, [peerId, loadMessages]);
    const nextTempId = () => ++tempIdCounter.current;
    const handleSend = () => {
        const content = text.trim();
        if (!content)
            return;
        const tempId = nextTempId();
        socketService.sendMessage({ receiver_id: peerId, type: 'text', content, temp_id: tempId });
        const optimistic: Message = {
            id: tempId,
            _tempId: tempId,
            sender_id: user!.id,
            receiver_id: peerId,
            type: 'text',
            content,
            created_at: new Date().toISOString(),
        };
        setList((prev) => [...prev, optimistic]);
        setText('');
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };
    const handleSendImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.8,
            });
            if (result.canceled || !result.assets?.[0])
                return;
            const asset = result.assets[0];
            await uploadAndSend('image', asset.uri, asset.fileName || 'image.jpg', asset.fileSize, resolveUploadMimeType(asset.fileName || asset.uri, asset.mimeType, 'image/jpeg'), asset.uri);
        }
        catch {
            Alert.alert('Error', 'Failed to choose an image');
        }
    };
    const handleSendVideo = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['videos'],
                quality: 0.8,
            });
            if (result.canceled || !result.assets?.[0])
                return;
            const asset = result.assets[0];
            await uploadAndSend('video', asset.uri, asset.fileName || 'video.mp4', asset.fileSize, resolveUploadMimeType(asset.fileName || asset.uri, asset.mimeType, 'video/mp4'), asset.uri);
        }
        catch {
            Alert.alert('Error', 'Failed to choose a video');
        }
    };
    const handleSendFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (result.canceled || !result.assets?.[0])
                return;
            const asset = result.assets[0];
            await uploadAndSend('file', asset.uri, asset.name, asset.size, resolveUploadMimeType(asset.name, asset.mimeType, 'application/pdf'), asset.uri);
        }
        catch {
            Alert.alert('Error', 'Failed to choose a file');
        }
    };
    const uploadAndSend = async (type: 'image' | 'video' | 'file', uri: string, name: string, size?: number | null, mimeType?: string, localUri?: string) => {
        setUploading(true);
        setUploadProgress(0);
        let cleanupUri: string | undefined;
        try {
            const prepared = await normalizeUploadAsset({
                uri,
                fileName: name,
                mimeType,
                fallbackMimeType: type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : 'application/pdf',
                fallbackBaseName: type === 'image' ? 'image' : type === 'video' ? 'video' : 'file',
            });
            cleanupUri = prepared.cleanupUri;
            const res = await files.uploadFile({
                uri: prepared.uri,
                name: prepared.fileName,
                type: prepared.mimeType,
            }, (p: any) => setUploadProgress(p));
            const data = res.data.data;
            if (!data)
                throw new Error('Upload failed');
            const tempId = nextTempId();
            socketService.sendMessage({
                receiver_id: peerId,
                type,
                file_locator: data.locator,
                file_name: data.original_name,
                file_size: data.file_size,
                temp_id: tempId,
            });
            const optimistic: Message = {
                id: tempId,
                _tempId: tempId,
                _localUri: localUri,
                sender_id: user!.id,
                receiver_id: peerId,
                type,
                content: null,
                file_locator: data.locator,
                file_name: data.original_name,
                file_size: data.file_size,
                created_at: new Date().toISOString(),
            };
            setList((prev) => mergeMessages([...prev, optimistic]));
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
        catch (e: any) {
            Alert.alert('Error', getApiErrorMessage(e, 'File upload failed'));
        }
        finally {
            if (cleanupUri) {
                LegacyFileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => { });
            }
            setUploading(false);
            setUploadProgress(0);
        }
    };
    const closeAttachmentSheet = () => {
        setAttachmentSheetVisible(false);
    };
    const runAttachmentAction = (action: () => void | Promise<void>) => {
        closeAttachmentSheet();
        setTimeout(() => {
            void action();
        }, 150);
    };
    const handleAttachment = () => {
        setAttachmentSheetVisible(true);
    };
    const handleRecall = (msg: Message) => {
        const sentAt = new Date(msg.created_at).getTime();
        const now = Date.now();
        if (now - sentAt > 2 * 60 * 1000) {
            Alert.alert('Notice', 'Messages can only be recalled within 2 minutes');
            return;
        }
        Alert.alert('Recall Message', 'Are you sure you want to recall this message?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Recall',
                style: 'destructive',
                onPress: () => {
                    socketService.recallMessage(msg.id);
                    setList((prev) => prev.map((m) => m.id === msg.id ? { ...m, is_recalled: true } : m));
                },
            },
        ]);
    };
    const loadEarlier = async () => {
        if (loadingMore || !hasMore)
            return;
        setLoadingMore(true);
        const firstId = list.length > 0 ? list[0].id : undefined;
        await loadMessages(firstId);
        setLoadingMore(false);
    };
    const formatSize = (bytes?: number | null) => {
        if (!bytes)
            return '';
        if (bytes < 1024)
            return `${bytes}B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };
    const handleOpenFile = async (locator?: string | null, fileName?: string | null, localUri?: string | null) => {
        if (localUri) {
            try {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(localUri, {
                        mimeType: inferMimeType(fileName || '', 'application/octet-stream'),
                        dialogTitle: fileName || 'Open file',
                    });
                    return;
                }
                await Linking.openURL(localUri);
                return;
            }
            catch {
                try {
                    await Share.share({ url: localUri, title: fileName || 'File' });
                    return;
                }
                catch {
                    Alert.alert('Error', 'Unable to open the local file');
                    return;
                }
            }
        }
        if (!locator)
            return;
        const url = files.getFileUrl(locator);
        setDownloading(true);
        setDownloadProgress(0);
        try {
            const tokens = await getTokens();
            const dest = new FSFile(Paths.cache, fileName || `download_${Date.now()}`);
            const downloadTask = LegacyFileSystem.createDownloadResumable(url, dest.uri, {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
            }, (progress) => {
                const total = progress.totalBytesExpectedToWrite || 0;
                const written = progress.totalBytesWritten || 0;
                if (total > 0) {
                    setDownloadProgress(Math.round((written * 100) / total));
                }
            });
            const result = await downloadTask.downloadAsync();
            if (!result?.uri) {
                throw new Error('Download failed');
            }
            setDownloadProgress(100);
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(result.uri, {
                    mimeType: inferMimeType(fileName || '', 'application/octet-stream'),
                    dialogTitle: fileName || 'Open file',
                });
                return;
            }
            await Share.share({ url: result.uri, title: fileName || 'File' });
        }
        catch {
            Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open the file'));
        }
        finally {
            setDownloading(false);
            setDownloadProgress(0);
        }
    };
    const getImageSource = (msg: Message) => {
        if (msg._localUri) {
            return { uri: msg._localUri };
        }
        if (msg.file_locator) {
            return files.getFileSource(msg.file_locator);
        }
        return undefined;
    };
    const renderLocalBadge = (label: string, own: boolean) => (<View style={[styles.localBadge, own && styles.localBadgeOwn]}>
        <Text style={[styles.localBadgeText, own && styles.localBadgeTextOwn]}>
            {label}
        </Text>
    </View>);
    const renderBubble = (msg: Message, own: boolean = false) => {
        if (msg.is_recalled) {
            return <Text style={styles.recalledText}>Message recalled</Text>;
        }
        switch (msg.type) {
            case 'image': {
                const imageSource = getImageSource(msg);
                return (<TouchableOpacity activeOpacity={0.9} onPress={() => imageSource && setPreviewImageSource(imageSource)}>
                    <Image source={imageSource} style={styles.imageMsg} resizeMode="cover" />
                </TouchableOpacity>);
            }
            case 'video':
                return (<TouchableOpacity style={[styles.videoCard, own && styles.videoCardOwn]} onPress={() => handleOpenFile(msg.file_locator, msg.file_name, msg._localUri)}>
                    <View style={styles.videoCardCenter}>
                        <Ionicons name="play-circle" size={40} color="#fff" />
                    </View>
                    <View style={styles.videoCardFooter}>
                        <Text style={[styles.fileName, styles.videoTitle, own && styles.ownText]} numberOfLines={1}>
                            {msg.file_name || 'Video'}
                        </Text>
                        <View style={styles.attachmentMetaRow}>
                            {!!msg._localUri && renderLocalBadge('Local preview', own)}
                            {msg.file_size != null && (<Text style={[styles.fileSize, own && { color: 'rgba(255,255,255,0.7)' }]}>
                                {formatSize(msg.file_size)}
                            </Text>)}
                        </View>
                    </View>
                </TouchableOpacity>);
            case 'file':
                return (<TouchableOpacity style={styles.fileContainer} onPress={() => handleOpenFile(msg.file_locator, msg.file_name, msg._localUri)}>
                    <Ionicons name="document-outline" size={28} color={own ? '#fff' : '#1277d6'} />
                    <View style={styles.fileInfo}>
                        <Text style={[styles.fileName, own && styles.ownText]} numberOfLines={1}>
                            {msg.file_name || 'File'}
                        </Text>
                        <View style={styles.attachmentMetaRow}>
                            {!!msg._localUri && renderLocalBadge('Local file', own)}
                            {msg.file_size != null && (<Text style={[styles.fileSize, own && { color: 'rgba(255,255,255,0.7)' }]}>
                                {formatSize(msg.file_size)}
                            </Text>)}
                        </View>
                    </View>
                </TouchableOpacity>);
            default:
                return <Text style={[styles.msgText, own && styles.ownText]}>{msg.content}</Text>;
        }
    };
    const isOwn = (msg: Message) => msg.sender_id === user?.id;
    const renderItem = ({ item }: {
        item: Message;
    }) => {
        const own = isOwn(item);
        const initial = (peerName || '?')[0].toUpperCase();
        if (item.is_recalled) {
            return (<View style={styles.recalledRow}>
                {renderBubble(item)}
            </View>);
        }
        return (<View style={[styles.row, own ? styles.rowRight : styles.rowLeft]}>
            {!own && (peerAvatar ? (<Image source={files.getFileSource(peerAvatar)} style={styles.peerAvatarImg} />) : (<View style={styles.peerAvatar}>
                <Text style={styles.peerAvatarText}>{initial}</Text>
            </View>))}
            <TouchableOpacity style={[
                styles.bubble,
                own ? styles.bubbleRight : styles.bubbleLeft,
                item.type === 'image' && styles.imageBubble,
            ]} activeOpacity={0.8} onLongPress={() => own && handleRecall(item)}>
                {renderBubble(item, own)}
            </TouchableOpacity>
        </View>);
    };
    return (<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {initialLoad && (<View style={styles.initialLoading}>
            <ActivityIndicator size="large" color="#1277d6" />
        </View>)}
        <FlatList ref={flatListRef} data={list} keyExtractor={(item) => String(item._tempId || item.id)} renderItem={renderItem} contentContainerStyle={styles.listContent} onContentSizeChange={() => {
            if (!loadingMore) {
                flatListRef.current?.scrollToEnd({ animated: false });
            }
        }} ListHeaderComponent={hasMore ? (<TouchableOpacity style={styles.loadMoreBtn} onPress={loadEarlier} disabled={loadingMore}>
            {loadingMore ? (<ActivityIndicator size="small" color="#1277d6" />) : (<Text style={styles.loadMoreText}>Load more messages</Text>)}
        </TouchableOpacity>) : null} />

        {uploading && (<View style={styles.uploadBar}>
            <Text style={styles.uploadText}>Uploading {uploadProgress}%</Text>
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
        </View>)}

        {downloading && (<View style={styles.uploadBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1277d6" />
                <Text style={[styles.uploadText, { marginLeft: 8, marginBottom: 0 }]}>
                    {downloadProgress > 0 ? `Downloaded ${downloadProgress}%` : 'Downloading...'}
                </Text>
            </View>
        </View>)}

        <View style={{ ...styles.inputBar, paddingBottom: bottomSpace }}>
            <TouchableOpacity onPress={handleAttachment} style={styles.attachBtn} disabled={uploading}>
                <Ionicons name="add" size={24} color={uploading ? '#ccc' : '#666'} />
            </TouchableOpacity>
            <TextInput style={styles.textInput} placeholder="Type a message..." placeholderTextColor="#999" value={text} onChangeText={setText} multiline maxLength={2000} />
            <TouchableOpacity style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} onPress={handleSend} disabled={!text.trim()}>
                <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
        </View>

        <Modal visible={attachmentSheetVisible} transparent animationType="slide">
            <Pressable style={styles.sheetBackdrop} onPress={closeAttachmentSheet}>
                <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.sheetTitle}>Send Attachment</Text>
                    <TouchableOpacity style={styles.sheetAction} onPress={() => runAttachmentAction(handleSendImage)}>
                        <Text style={styles.sheetActionText}>Image</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.sheetAction} onPress={() => runAttachmentAction(handleSendVideo)}>
                        <Text style={styles.sheetActionText}>Video</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.sheetAction} onPress={() => runAttachmentAction(handleSendFile)}>
                        <Text style={styles.sheetActionText}>File</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.sheetCancel} onPress={closeAttachmentSheet}>
                        <Text style={styles.sheetCancelText}>Cancel</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>

        <Modal visible={!!previewImageSource} transparent animationType="fade">
            <View style={styles.previewOverlay}>
                <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewImageSource(null)}>
                    <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                {previewImageSource && (<Image source={previewImageSource} style={styles.previewImage} resizeMode="contain" />)}
            </View>
        </Modal>
    </KeyboardAvoidingView>);
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    listContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    loadMoreBtn: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    loadMoreText: {
        fontSize: 13,
        color: '#1277d6',
    },
    row: {
        flexDirection: 'row',
        marginVertical: 4,
        alignItems: 'flex-end',
    },
    rowLeft: {
        justifyContent: 'flex-start',
    },
    rowRight: {
        justifyContent: 'flex-end',
    },
    peerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: '#1277d6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    peerAvatarImg: {
        width: 36,
        height: 36,
        borderRadius: 6,
        marginRight: 8,
    },
    peerAvatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    bubble: {
        maxWidth: '70%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    bubbleLeft: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 4,
    },
    bubbleRight: {
        backgroundColor: '#1277d6',
        borderTopRightRadius: 4,
    },
    imageBubble: {
        padding: 4,
        backgroundColor: 'transparent',
    },
    initialLoading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    msgText: {
        fontSize: 16,
        lineHeight: 22,
        color: '#333',
    },
    ownText: {
        color: '#fff',
    },
    imageMsg: {
        width: 180,
        height: 180,
        borderRadius: 8,
        backgroundColor: '#E8E8E8',
    },
    fileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 140,
    },
    fileInfo: {
        marginLeft: 8,
        flex: 1,
    },
    attachmentMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
        flexWrap: 'wrap',
    },
    fileName: {
        fontSize: 14,
        color: '#333',
    },
    videoTitle: {
        color: '#fff',
        fontWeight: '600',
    },
    fileSize: {
        fontSize: 12,
        color: '#999',
    },
    localBadge: {
        backgroundColor: 'rgba(7,193,96,0.12)',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    localBadgeOwn: {
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    localBadgeText: {
        fontSize: 11,
        color: '#1277d6',
        fontWeight: '600',
    },
    localBadgeTextOwn: {
        color: '#fff',
    },
    videoCard: {
        width: 190,
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1E1E1E',
        justifyContent: 'space-between',
    },
    videoCardOwn: {
        backgroundColor: '#0A8F4E',
    },
    videoCardCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoCardFooter: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: 'rgba(0,0,0,0.28)',
    },
    recalledRow: {
        alignItems: 'center',
        marginVertical: 8,
    },
    recalledText: {
        fontSize: 13,
        color: '#999',
        fontStyle: 'italic',
    },
    uploadBar: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E0E0E0',
    },
    uploadText: {
        fontSize: 12,
        color: '#1277d6',
        marginBottom: 4,
    },
    progressTrack: {
        height: 4,
        backgroundColor: '#E8E8E8',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: 4,
        backgroundColor: '#1277d6',
        borderRadius: 2,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: '#F7F7F7',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E0E0E0',

    },
    attachBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8E8E8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    textInput: {
        flex: 1,
        minHeight: 36,
        maxHeight: 100,
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 16,
        color: '#333',
    },
    sendBtn: {
        marginLeft: 8,
        backgroundColor: '#1277d6',
        borderRadius: 18,
        paddingHorizontal: 16,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.5,
    },
    sendBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    sheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 24,
    },
    sheetTitle: {
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
        marginBottom: 10,
    },
    sheetAction: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 8,
    },
    sheetActionText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    sheetCancel: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    sheetCancelText: {
        fontSize: 16,
        color: '#FF3B30',
        fontWeight: '600',
    },
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewClose: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 8,
    },
    previewImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
    },
});
export default ChatScreen;
