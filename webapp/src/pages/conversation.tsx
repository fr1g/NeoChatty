import { useContext, useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { useParams } from "react-router";
import { ReusableFuncs, ToastableContext } from "../main";
import { ChevronLeftIcon, SendIcon, AttachIcon, ImageIcon, VideoIcon, FileIcon, EllipsisIcon } from "tdesign-icons-react";
import { useAuth } from "../context/AuthContext";
import { messages as messagesApi, files, users as usersApi } from "../api/index";
import { ChattySocket as socketService } from 'chatty-sdk';
import type { Message } from "chatty-sdk";

type MessageActionMenuState = {
    messageKey: number;
    x: number;
    y: number;
};

const MESSAGE_RECALL_WINDOW_MS = 2 * 60 * 1000;

export function Conversation() {
    const { chatId } = useParams();
    const reuses = useContext(ReusableFuncs);
    const toastable = useContext(ToastableContext);
    const { user } = useAuth();
    const [list, setList] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewVideo, setPreviewVideo] = useState<{
        src: string;
        name: string;
    } | null>(null);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [actionMenu, setActionMenu] = useState<MessageActionMenuState | null>(null);
    const [peerName, setPeerName] = useState('');
    const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
    const chatArea = useRef<HTMLDivElement>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<Message[]>([]);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);
    const videoInput = useRef<HTMLInputElement>(null);
    const tempIdCounter = useRef(Date.now());
    const localObjectUrlsRef = useRef<Set<string>>(new Set());
    const shouldAutoScrollRef = useRef(true);
    const pendingInitialScrollRef = useRef(true);
    const pendingPrependRef = useRef<{
        prevHeight: number;
        prevTop: number;
    } | null>(null);
    const initialScrollFrameRef = useRef<number | null>(null);
    const initialScrollTimeoutRef = useRef<number | null>(null);
    const peerId = chatId ? Number.parseInt(chatId, 10) : null;
    const clearPendingInitialScroll = useCallback(() => {
        if (initialScrollFrameRef.current !== null) {
            window.cancelAnimationFrame(initialScrollFrameRef.current);
            initialScrollFrameRef.current = null;
        }
        if (initialScrollTimeoutRef.current !== null) {
            window.clearTimeout(initialScrollTimeoutRef.current);
            initialScrollTimeoutRef.current = null;
        }
    }, []);
    useEffect(() => {
        return () => {
            clearPendingInitialScroll();
            for (const objectUrl of localObjectUrlsRef.current) {
                URL.revokeObjectURL(objectUrl);
            }
            localObjectUrlsRef.current.clear();
        };
    }, [clearPendingInitialScroll]);
    useEffect(() => {
        listRef.current = list;
    }, [list]);
    const getMessageKey = (message: Message) => message._tempId ?? message.id;
    const isOwn = (message: Message) => message.sender_id === user?.id;
    const parseMessageTimestamp = (value: unknown) => {
        if (typeof value !== 'string' && !(value instanceof Date)) {
            return null;
        }
        const timestamp = new Date(value).getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    };
    const closeActionMenu = useCallback(() => {
        setActionMenu(null);
    }, []);
    const createLocalPreviewUrl = (file: File) => {
        const objectUrl = URL.createObjectURL(file);
        localObjectUrlsRef.current.add(objectUrl);
        return objectUrl;
    };
    const mergeMessages = useCallback((msgs: Message[]) => {
        const map = new Map<number, Message>();
        msgs.forEach(message => map.set(message.id, message));
        return [...map.values()].sort((left, right) => left.id - right.id);
    }, []);
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
        if (!chatArea.current) {
            return;
        }
        chatArea.current.scrollTo({
            top: chatArea.current.scrollHeight,
            behavior,
        });
    }, []);
    const syncInitialScrollToBottom = useCallback(() => {
        if (!chatArea.current) {
            return;
        }
        clearPendingInitialScroll();
        scrollToBottom('auto');
        initialScrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollToBottom('auto');
        });
        initialScrollTimeoutRef.current = window.setTimeout(() => {
            scrollToBottom('auto');
        }, 240);
    }, [clearPendingInitialScroll, scrollToBottom]);
    const loadMessages = useCallback(async (before?: number) => {
        if (!peerId || Number.isNaN(peerId))
            return;
        if (before && chatArea.current) {
            pendingPrependRef.current = {
                prevHeight: chatArea.current.scrollHeight,
                prevTop: chatArea.current.scrollTop,
            };
        }
        try {
            const res = await messagesApi.getMessages(peerId, before);
            const msgs: Message[] = res.data.data ?? [];
            if (msgs.length === 0) {
                setHasMore(false);
                return;
            }
            setList(prev => mergeMessages(before ? [...msgs, ...prev] : msgs));
        }
        catch {
            if (!before) {
                alert('Failed to load messages');
            }
        }
        finally {
            if (!before) {
                setInitialLoad(false);
            }
        }
    }, [mergeMessages, peerId]);
    useEffect(() => {
        if (!peerId || Number.isNaN(peerId))
            return;
        setList([]);
        setText('');
        setHasMore(true);
        setInitialLoad(true);
        shouldAutoScrollRef.current = true;
        pendingInitialScrollRef.current = true;
        clearPendingInitialScroll();
        void loadMessages();
        socketService.markAsRead(peerId);
        const offMsg = socketService.onMessage((msg: Message) => {
            if (msg.sender_id === peerId || msg.receiver_id === peerId) {
                shouldAutoScrollRef.current = true;
                setList(prev => mergeMessages([...prev, msg]));
                socketService.markAsRead(peerId);
            }
        });
        const offRecall = socketService.onMessageRecalled((data: {
            message_id: number;
        }) => {
            const recalledMessage = listRef.current.find(message => message.id === data.message_id);
            const recalledOwnMessage = recalledMessage?.sender_id === user?.id;
            setList(prev => prev.map(message => message.id === data.message_id ? { ...message, is_recalled: true } : message));
            if (recalledOwnMessage) {
                toastable()?.('Message recalled', 'blur', 0, 1800);
            }
        });
        const offAck = socketService.onMessageAck((data: {
            id: number;
            created_at: string;
            temp_id?: number;
        }) => {
            setList(prev => prev.map(message => message._tempId && message._tempId === data.temp_id
                ? {
                    ...message,
                    id: data.id,
                    created_at: parseMessageTimestamp(data.created_at) === null ? message.created_at : data.created_at,
                    _tempId: undefined
                }
                : message));
        });
        const offError = socketService.onMessageError((data: {
            reason: string;
        }) => {
            alert('Action failed: ' + data.reason);
        });
        return () => {
            offMsg();
            offRecall();
            offAck();
            offError();
        };
    }, [clearPendingInitialScroll, loadMessages, mergeMessages, peerId, toastable, user?.id]);
    useEffect(() => {
        if (!peerId || Number.isNaN(peerId))
            return;
        usersApi.getUserProfile(peerId).then(res => {
            const profile = res.data.data;
            if (profile) {
                setPeerName(profile.display_name || profile.username || '?');
                setPeerAvatar(profile.avatar_locator || null);
            }
        }).catch(() => {
            setPeerName('');
            setPeerAvatar(null);
        });
    }, [peerId]);
    useEffect(() => {
        closeActionMenu();
        setShowAttachMenu(false);
    }, [chatId, closeActionMenu]);
    useEffect(() => {
        if (!actionMenu) {
            return;
        }
        const handlePointerDown = (event: PointerEvent) => {
            if (actionMenuRef.current?.contains(event.target as Node)) {
                return;
            }
            closeActionMenu();
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeActionMenu();
            }
        };
        const handleResize = () => {
            closeActionMenu();
        };
        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleEscape);
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
            window.removeEventListener('resize', handleResize);
        };
    }, [actionMenu, closeActionMenu]);
    useEffect(() => {
        if (actionMenu && !list.some(message => getMessageKey(message) === actionMenu.messageKey)) {
            closeActionMenu();
        }
    }, [actionMenu, closeActionMenu, list]);
    useLayoutEffect(() => {
        if (!actionMenu || !actionMenuRef.current) {
            return;
        }
        const menuRect = actionMenuRef.current.getBoundingClientRect();
        const padding = 12;
        const nextX = Math.min(Math.max(actionMenu.x, padding), window.innerWidth - menuRect.width - padding);
        const nextY = Math.min(Math.max(actionMenu.y, padding), window.innerHeight - menuRect.height - padding);
        if (nextX !== actionMenu.x || nextY !== actionMenu.y) {
            setActionMenu(current => current?.messageKey === actionMenu.messageKey
                ? { ...current, x: nextX, y: nextY }
                : current);
        }
    }, [actionMenu]);
    useLayoutEffect(() => {
        if (!chatArea.current) {
            return;
        }
        const pending = pendingPrependRef.current;
        if (pending) {
            const currentHeight = chatArea.current.scrollHeight;
            chatArea.current.scrollTop = currentHeight - pending.prevHeight + pending.prevTop;
            pendingPrependRef.current = null;
            return;
        }
        if (!initialLoad && pendingInitialScrollRef.current) {
            syncInitialScrollToBottom();
            pendingInitialScrollRef.current = false;
            return;
        }
        if (shouldAutoScrollRef.current) {
            scrollToBottom(initialLoad ? 'auto' : 'smooth');
        }
    }, [initialLoad, list, scrollToBottom, syncInitialScrollToBottom]);
    const handleScroll = () => {
        if (!chatArea.current)
            return;
        const distanceToBottom = chatArea.current.scrollHeight - chatArea.current.scrollTop - chatArea.current.clientHeight;
        shouldAutoScrollRef.current = distanceToBottom < 80;
        if (actionMenu) {
            closeActionMenu();
        }
    };
    const getRecallAvailability = (message: Message) => {
        if (!isOwn(message)) {
            return {
                enabled: false,
                helper: 'Only your own messages can be recalled',
            };
        }
        if (message.is_recalled) {
            return {
                enabled: false,
                helper: 'This message has already been recalled',
            };
        }
        if (message._tempId != null) {
            return {
                enabled: false,
                helper: 'This message is still sending and can be recalled after the server confirms it',
            };
        }
        const sentAt = parseMessageTimestamp(message.created_at);
        if (sentAt === null) {
            console.warn('Invalid message timestamp (maybe timeout or not got):', message.created_at);
            return {
                enabled: false,
                helper: 'Operation Invalid',
            };
        }
        const remainingMs = MESSAGE_RECALL_WINDOW_MS - (Date.now() - sentAt);
        if (remainingMs <= 0) {
            return {
                enabled: false,
                helper: 'Messages can only be recalled within 2 minutes',
            };
        }
        const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
        return {
            enabled: true,
            helper: `Can be recalled for about ${seconds} more seconds`,
        };
    };
    const canOpenActionMenu = (message: Message) => isOwn(message) && !message.is_recalled && message._tempId == null;
    const openActionMenu = (message: Message, x: number, y: number) => {
        setShowAttachMenu(false);
        setActionMenu({
            messageKey: getMessageKey(message),
            x,
            y,
        });
    };
    const handleActionMenuButton = (message: Message, trigger: HTMLButtonElement) => {
        if (actionMenu?.messageKey === getMessageKey(message)) {
            closeActionMenu();
            return;
        }
        const rect = trigger.getBoundingClientRect();
        openActionMenu(message, rect.right - 144, rect.bottom + 10);
    };
    const nextTempId = () => ++tempIdCounter.current;
    const handleSend = () => {
        const content = text.trim();
        if (!content || !peerId || Number.isNaN(peerId) || !user)
            return;
        const tempId = nextTempId();
        shouldAutoScrollRef.current = true;
        socketService.sendMessage({ receiver_id: peerId, type: 'text', content, temp_id: tempId });
        const optimistic: Message = {
            id: tempId,
            _tempId: tempId,
            sender_id: user.id,
            receiver_id: peerId,
            type: 'text',
            content,
            file_locator: null,
            file_name: null,
            file_size: null,
            is_recalled: false,
            is_read: false,
            created_at: new Date().toISOString(),
        };
        setList(prev => mergeMessages([...prev, optimistic]));
        setText('');
        inputRef.current?.focus();
    };
    const uploadAndSend = async (type: 'image' | 'video' | 'file', file: File) => {
        if (!peerId || Number.isNaN(peerId) || !user)
            return;
        setUploading(true);
        setUploadProgress(0);
        setShowAttachMenu(false);
        const localUri = createLocalPreviewUrl(file);
        try {
            const res = await files.uploadFile(file, progress => setUploadProgress(progress));
            const data = res.data.data;
            if (!data)
                throw new Error('Upload failed');
            const tempId = nextTempId();
            shouldAutoScrollRef.current = true;
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
                sender_id: user.id,
                receiver_id: peerId,
                type,
                content: null,
                file_locator: data.locator,
                file_name: data.original_name,
                file_size: data.file_size,
                is_recalled: false,
                is_read: false,
                created_at: new Date().toISOString(),
            };
            setList(prev => mergeMessages([...prev, optimistic]));
        }
        catch (e: any) {
            alert('File upload failed: ' + (e?.response?.data?.error?.message || e?.message || 'Unknown error'));
        }
        finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };
    const handleRecall = (msg: Message) => {
        const recallState = getRecallAvailability(msg);
        if (!recallState.enabled) {
            alert(recallState.helper);
            return;
        }
        closeActionMenu();
        if (confirm('Are you sure you want to recall this message?')) {
            socketService.recallMessage(msg.id);
        }
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
    const resolveAttachmentUrl = (msg: Message) => {
        if (msg._localUri) {
            return msg._localUri;
        }
        if (msg.file_locator) {
            return files.getFileUrl(msg.file_locator);
        }
        return null;
    };
    const openAttachmentTarget = (target: string | null) => {
        if (!target)
            return;
        window.open(target, '_blank', 'noopener,noreferrer');
    };
    const openAttachment = (msg: Message) => {
        openAttachmentTarget(resolveAttachmentUrl(msg));
    };
    const resolveImageUrl = (msg: Message) => {
        return resolveAttachmentUrl(msg) || '';
    };
    const handleMessageMediaLoad = () => {
        if (shouldAutoScrollRef.current) {
            scrollToBottom('auto');
        }
    };
    const renderBubble = (msg: Message, own: boolean) => {
        if (msg.is_recalled) {
            return <span className="text-xs text-slate-400 italic">Message recalled</span>;
        }
        switch (msg.type) {
            case 'image': {
                const src = resolveImageUrl(msg);
                return (<img src={src} className="max-w-48 max-h-48 rounded-lg cursor-pointer object-cover" onClick={() => setPreviewImage(src)} onLoad={handleMessageMediaLoad} />);
            }
            case 'video':
                {
                    const src = resolveAttachmentUrl(msg);
                    if (!src) {
                        return <span className={`text-sm ${own ? 'text-white/80' : 'text-slate-500'}`}>Video preview is not available yet</span>;
                    }
                    const videoName = msg.file_name || 'Video';
                    return (<div className={`w-[min(22rem,70vw)] overflow-hidden rounded-[1.25rem] ${own ? 'bg-[#0a8f4e]/15 ring-1 ring-white/12' : 'bg-slate-950/90 ring-1 ring-slate-800'} text-white shadow-lg`}>
                        <video src={src} controls preload="metadata" className="block w-full max-h-80 bg-black" onLoadedMetadata={handleMessageMediaLoad} />
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-black/25">
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{videoName}</p>
                                <p className="text-xs text-white/70 mt-1">{formatSize(msg.file_size)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button type="button" onClick={() => setPreviewVideo({ src, name: videoName })} className="px-2.5 py-1 rounded-full bg-white/12 hover:bg-white/18 text-xs font-medium">
                                    Open
                                </button>
                                <button type="button" onClick={() => openAttachmentTarget(src)} className="px-2.5 py-1 rounded-full bg-white/12 hover:bg-white/18 text-xs font-medium">
                                    New Window
                                </button>
                            </div>
                        </div>
                    </div>);
                }
            case 'file':
                return (<button type="button" onClick={() => openAttachment(msg)} className="flex items-center gap-3 text-left">
                    <FileIcon size="24px" />
                    <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${own ? 'text-white' : ''}`}>{msg.file_name || 'File'}</p>
                        <p className={`text-xs truncate ${own ? 'text-white/70' : 'text-slate-400'}`}>{formatSize(msg.file_size)}</p>
                    </div>
                </button>);
            default:
                return <span className={`text-sm break-all whitespace-pre-wrap ${own ? 'text-white' : ''}`}>{msg.content}</span>;
        }
    };
    if (!chatId || !peerId || Number.isNaN(peerId)) {
        return <div className="w-full h-full grid items-center justify-items-center">
            <div className="text-center">
                <p className="text-slate-400 text-lg">Select a chat to start talking</p>
                <p className="text-sm text-slate-500 mt-2">The conversation list here and the RN client now use the same API.</p>
            </div>
        </div>;
    }
    const initial = (peerName || '?')[0]?.toUpperCase();
    const menuMessage = actionMenu
        ? list.find(message => getMessageKey(message) === actionMenu.messageKey) ?? null
        : null;
    return <div className="size-full flex flex-col relative">
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-600 items-center gap-1.5 p-2 shadow-md z-1">
            <div onClick={() => reuses?.goHome()} className="border-button grid items-center justify-items-center sm:hidden aspect-square">
                <ChevronLeftIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
            </div>
            <div className="grow min-w-0">
                <h3 className="text-lg font-semibold text-nowrap max-w-[56vw] sm:max-w-[66vw] text-ellipsis overflow-hidden">{peerName || 'Loading...'}</h3>
            </div>
            {peerAvatar ? (<img src={files.getFileUrl(peerAvatar)} className="w-9 h-9 rounded-lg object-cover cursor-pointer" onClick={() => reuses?.setUserView(String(peerId))} />) : (<div className="w-9 h-9 rounded-lg bg-[#1277d6] flex items-center justify-center text-white font-bold cursor-pointer" onClick={() => reuses?.setUserView(String(peerId))}>
                {initial}
            </div>)}
        </div>

        <div ref={chatArea} onScroll={handleScroll} className="flex flex-col rounded-lg grow h-full overflow-x-hidden overflow-y-auto py-3 relative gap-1">
            {hasMore && (<div className="text-center py-2">
                <button onClick={loadEarlier} disabled={loadingMore} className="text-sm text-[#1277d6] hover:underline disabled:opacity-50">
                    {loadingMore ? 'Loading...' : 'Load more messages'}
                </button>
            </div>)}

            {initialLoad && (<div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-[#1277d6] border-t-transparent rounded-full"></div>
            </div>)}

            {!initialLoad && list.length === 0 && (<div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-slate-400">No messages yet. Say hello first.</p>
            </div>)}

            {list.map(msg => {
                const own = isOwn(msg);
                const messageKey = getMessageKey(msg);
                if (msg.is_recalled) {
                    return <div key={messageKey} className="text-center py-1">
                        <span className="text-xs text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-0.5 rounded">Message recalled</span>
                    </div>;
                }
                return (
                    <div key={messageKey} className={`group flex items-end gap-2 ${own ? 'flex-row-reverse' : ''} px-1`}>

                        <div className={`max-w-[70%] px-3 py-2 rounded-xl ${own
                            ? 'bg-[#1277d6] text-white! rounded-tr-sm'
                            : 'bg-white dark:bg-slate-700 rounded-tl-sm shadow-sm'} ${msg.type === 'image' || msg.type === 'video' ? 'p-1 bg-transparent!' : ''}`} onContextMenu={(event) => {
                                if (canOpenActionMenu(msg)) {
                                    event.preventDefault();
                                    openActionMenu(msg, event.clientX + 8, event.clientY + 8);
                                }
                            }}>
                            {renderBubble(msg, own)}
                        </div>
                        {canOpenActionMenu(msg) && (<button type="button" aria-label="Message actions" className={`shrink-0 self-center rounded-full border border-slate-300/80 bg-white/88 p-1.5 text-slate-500 shadow-sm backdrop-blur-sm hover:border-[#1277d6]/50 hover:text-[#1277d6] focus:outline-none focus:ring-2 focus:ring-[#1277d6]/35 dark:border-slate-500/70 dark:bg-slate-800/88 dark:text-slate-200 opacity-100 sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto sm:focus:opacity-100 sm:focus:pointer-events-auto ${actionMenu?.messageKey === messageKey ? 'sm:opacity-100 sm:pointer-events-auto border-[#1277d6]/45 text-[#1277d6]' : ''}`} onClick={(event) => {
                            event.stopPropagation();
                            handleActionMenuButton(msg, event.currentTarget);
                        }}>
                            <EllipsisIcon size="16px" />
                        </button>)}
                    </div>);
            })}
        </div>

        {uploading && (<div className="px-3 py-1 bg-slate-100 dark:bg-slate-700">
            <p className="text-xs text-slate-500 mb-1">Uploading {uploadProgress}%</p>
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#1277d6] transition-all" style={{ width: `${uploadProgress}%` }}></div>
            </div>
        </div>)}

        {showAttachMenu && (<div className="absolute bottom-16 left-3 bg-white dark:bg-slate-700 rounded-lg shadow-lg p-2 z-10 flex gap-1">
            <div onClick={() => imageInput.current?.click()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg cursor-pointer flex items-center gap-1 text-sm">
                <ImageIcon size="18px" /> Image
            </div>
            <div onClick={() => videoInput.current?.click()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg cursor-pointer flex items-center gap-1 text-sm">
                <VideoIcon size="18px" /> Video
            </div>
            <div onClick={() => fileInput.current?.click()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg cursor-pointer flex items-center gap-1 text-sm">
                <FileIcon size="18px" /> File
            </div>
        </div>)}

        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={event => {
            const file = event.target.files?.[0];
            if (file)
                void uploadAndSend('image', file);
            event.target.value = '';
        }} />
        <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={event => {
            const file = event.target.files?.[0];
            if (file)
                void uploadAndSend('video', file);
            event.target.value = '';
        }} />
        <input ref={fileInput} type="file" className="hidden" onChange={event => {
            const file = event.target.files?.[0];
            if (file)
                void uploadAndSend('file', file);
            event.target.value = '';
        }} />

        <div className="w-full min-h-14 text-sm sm:min-h-16 sm:text-base flex gap-1.5 sm:gap-2 mt-1 bottom-0 left-0 right-0">
            <div onClick={() => setShowAttachMenu(current => !current)} className={`grid items-center justify-items-center shrink-0 w-10 rounded-lg cursor-pointer ${uploading ? 'opacity-50' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                <AttachIcon size="20px" />
            </div>
            <textarea ref={inputRef} onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                }
            }}
                onChange={(event) => setText(event.target.value)} value={text}
                style={{ resize: 'none', touchAction: 'manipulation' }}
                placeholder="Type a message..."
                className="text-base rounded-lg size-full grow focus:outline-2 focus:outline-slate-400 shadow-md bg-slate-100/80 dark:bg-slate-800/50 p-1.5" enterKeyHint="send"
            ></textarea>
            <div className={`${!text.trim() ? 'bg-gray-300/80 cursor-not-allowed! pointer-events-none' : 'bg-blue-400 hover:bg-blue-300/80 active:bg-blue-400/70 text-white'}
                     grid shadow-md items-center min-w-8 h-full justify-items-center rounded-lg aspect-square cursor-pointer`} onClick={handleSend}>
                <SendIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />
            </div>
        </div>

        {previewImage && (<div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => setPreviewImage(null)}>
            <img src={previewImage} className="max-w-[90vw] max-h-[90vh] object-contain" />
            <button className="absolute top-4 right-4 text-white text-2xl" onClick={() => setPreviewImage(null)}>✕</button>
        </div>)}

        {previewVideo && (<div className="fixed inset-0 bg-black/88 z-50 flex items-center justify-center p-4" onClick={() => setPreviewVideo(null)}>
            <div className="w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
                <video src={previewVideo.src} controls autoPlay preload="metadata" className="w-full max-h-[82vh] rounded-[1.5rem] bg-black shadow-2xl" />
                <div className="mt-3 flex items-center justify-between gap-3 text-white">
                    <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{previewVideo.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => openAttachmentTarget(previewVideo.src)} className="px-3 py-1.5 rounded-full bg-white/12 hover:bg-white/18 text-sm">
                            New Window
                        </button>
                        <button type="button" onClick={() => setPreviewVideo(null)} className="px-3 py-1.5 rounded-full bg-white/12 hover:bg-white/18 text-sm">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>)}

        {actionMenu && menuMessage && (<>
            <div className="fixed inset-0 z-40" />
            <div ref={actionMenuRef} className="fixed z-50 w-36 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 p-1 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-slate-600/60 dark:bg-slate-800/95" style={{
                left: actionMenu.x,
                top: actionMenu.y,
            }}>
                <button type="button" className="flex w-full items-center justify-center rounded-[1rem] px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50/90 dark:text-red-200 dark:hover:bg-red-500/12" onClick={() => handleRecall(menuMessage)}>
                    Recall
                </button>
            </div>
        </>)}
    </div>;
}
