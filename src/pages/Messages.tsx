import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, limit, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { Send, Search, CheckCheck, Loader2, ChevronLeft, MoreVertical, Paperclip, Smile, X, Image as ImageIcon, FileText, Trash2, Edit, AlertCircle, Check, Laptop, Sparkles, MessageSquare, Download, Lock, Users, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api, { schoolService, fileService, authService } from '../services/api';
import { useLocation } from 'react-router-dom';

const EMOJI_LIST = [
  { char: '😀', name: 'grinning' }, { char: '😂', name: 'joy' }, { char: '😍', name: 'heart_eyes' },
  { char: '👍', name: 'thumbs_up' }, { char: '🔥', name: 'fire' }, { char: '🙏', name: 'folded_hands' },
  { char: '🎉', name: 'tada' }, { char: '❤️', name: 'heart' }, { char: '✨', name: 'sparkles' },
  { char: '🤔', name: 'thinking' }, { char: '😎', name: 'cool' }, { char: '😢', name: 'cry' },
  { char: '👏', name: 'applause' }, { char: '🙌', name: 'hands_up' }, { char: '🚀', name: 'rocket' },
  { char: '💡', name: 'bulb' }, { char: '👀', name: 'eyes' }, { char: '💯', name: 'hundred' },
  { char: '✅', name: 'check' }, { char: '❌', name: 'cross' }, { char: '⚠️', name: 'warning' }
];

interface Attachment {
  url: string;
  name: string;
  type: 'image' | 'file';
  size?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// FIX: Bug 2 - Remove throw from handleFirestoreError. Let callers decide whether to rethrow or catch.
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('[FIRESTORE_CRITICAL_ERROR]', JSON.stringify(errInfo));
}

export default function Messages({ user }: { user: any }) {
  const location = useLocation();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  
  const [myChats, setMyChats] = useState<{
    group: any | null;
    dms: any[];
    support: any | null;
  }>({ group: null, dms: [], support: null });
  const [chatType, setChatType] = useState<'support' | 'group' | 'dm' | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  
  // Firebase Auth sync checkpoint
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseTimeout, setFirebaseTimeout] = useState(false);
  const [sendError, setSendError] = useState('');
  const [debugError, setDebugError] = useState('');
  
  // Custom interactive extensions
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, 'online' | 'offline'>>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Optimistic & Persistent Native Unsent Messages Queue
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const [offlineMessageQueue, setOfflineMessageQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('edunexus_offline_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveOfflineMessages = (queue: any[]) => {
    try {
      localStorage.setItem('edunexus_offline_messages', JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save offline messages:', e);
    }
  };

  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [downloadingUrls, setDownloadingUrls] = useState<Record<string, boolean>>({});
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [actionSheetMsg, setActionSheetMsg] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; senderName: string; attachment?: any } | null>(null);
  const [swipeDelta, setSwipeDelta] = useState<Record<string, number>>({});
  const [swipeStartX, setSwipeStartX] = useState<Record<string, number>>({});
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [backfillDone, setBackfillDone] = useState(false);

  const toggleSelectMessage = (id: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleFileDownload = async (url: string, name: string) => {
    if (downloadingUrls[url]) return;
    setDownloadingUrls(prev => ({ ...prev, [url]: true }));
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingUrls(prev => ({ ...prev, [url]: false }));
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSuper = user?.role === 'SUPER_ADMIN';

  // Helper to resolve messaged dates uniformly regardless of Timestamp/String/Object representation
  const getMessageDate = (createdAt: any): Date => {
    if (!createdAt) return new Date();
    if (typeof createdAt.toDate === 'function') {
      try {
        return createdAt.toDate();
      } catch {
        return new Date();
      }
    }
    if (createdAt instanceof Date) return createdAt;
    if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      return new Date(createdAt);
    }
    return new Date();
  };

  // Log activity helper
  const logChatAction = async (action: string, details: string) => {
    try {
      await api.post('/v1/chats/log-activity', {
        action,
        details,
        schoolId: selectedChat?.id || 'SUPER'
      });
    } catch (err) {
      console.error('[ACTIVIY_LOG_ERROR] Could not write activity audit trail:', err);
    }
  };

  useEffect(() => {
    fetchMyChats();
    // Set static online status indicator for Super Admin support
    setOnlineStatus(prev => ({ ...prev, 'SUPER': 'online' }));
  }, [user?.id]);

  // Timeout handler for firebase auth connection
  useEffect(() => {
    if (firebaseReady) {
      setFirebaseTimeout(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!firebaseReady) {
        setFirebaseTimeout(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [firebaseReady]);

  // Dynamic Self-Healing Firebase Auth Restorer & Sync Hub
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    
    // Set initial custom token ready state if firebase already authenticated
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      setFirebaseReady(true);
    }

    // FIX: Bug 1 - checkAndRestoreAuth using cached localStorage token first
    const checkAndRestoreAuth = async () => {
      // If Firebase already has a valid authenticated user, we are done immediately
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        if (isMounted) setFirebaseReady(true);
        return;
      }

      // Only fall back to cached token or fetch if auth.currentUser is null
      if (auth.currentUser === null) {
        // Step 1: Try cached token FIRST (instant, no network needed)
        const cachedToken = localStorage.getItem('fireToken');
        if (cachedToken) {
          try {
            console.log('[MESSAGES_AUTH_RESTORER] Attempting authentication with cached token...');
            await signInWithCustomToken(auth, cachedToken);
            if (isMounted) {
              setFirebaseReady(true);
              return;
            }
          } catch (cacheErr) {
            console.warn('[MESSAGES_AUTH_RESTORER] Cached token invalid or expired. Cleaning up localStorage:', cacheErr);
            localStorage.removeItem('fireToken');
          }
        }

        // Step 2: Only call /auth/me if cached token failed or didn't exist
        try {
          console.log('[MESSAGES_AUTH_RESTORER] Fetching fresh Firebase token from session...');
          const { data } = await authService.getCurrentUser();
          if (data && data.firebaseToken && isMounted) {
            console.log('[MESSAGES_AUTH_RESTORER] Retrieved fresh Firebase token from session, authenticating...');
            localStorage.setItem('fireToken', data.firebaseToken);
            try {
              await signInWithCustomToken(auth, data.firebaseToken);
              if (isMounted) {
                setFirebaseReady(true);
              }
            } catch (signInErr: any) {
              console.error('[MESSAGES_AUTH_RESTORER] Custom token sign-in failed:', signInErr);
              if (isMounted) {
                setFirebaseTimeout(true);
                setDebugError((signInErr?.message || '') + ' code: ' + (signInErr?.code || ''));
              }
            }
          }
        } catch (err) {
          console.error('[MESSAGES_AUTH_RESTORER] Failed to restore Firebase auth:', err);
        }
      }
    };

    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && !fbUser.isAnonymous) {
        console.log('[FIREBASE_AUTH] Synchronized with custom authenticated user:', fbUser.uid);
        if (isMounted) setFirebaseReady(true);
      } else {
        console.log('[FIREBASE_AUTH] Waiting for custom authenticated session token...');
        if (isMounted) {
          setFirebaseReady(false);
          // Only re-trigger restoration if firebase was previously ready (genuine expiry)
          // NOT on initial mount (checkAndRestoreAuth already runs below)
        }
      }
    });

    // Run first-pass restoration checklist
    checkAndRestoreAuth();
    
    // Periodic safety heartbeat (recheck every 15 seconds)
    const interval = setInterval(() => {
      if (!auth.currentUser || auth.currentUser.isAnonymous) {
        checkAndRestoreAuth();
      }
    }, 15000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [user?.id]);

  // Deep linking support
  const fetchMyChats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/chats/my-chats');
      if (isSuper) {
        const dmsList = Array.isArray(res.data) ? res.data : [];
        setMyChats({
          group: null,
          dms: dmsList,
          support: null
        });
        setSchools(dmsList);
        
        const statusSeed: Record<string, 'online' | 'offline'> = {};
        dmsList.forEach((s: any) => {
          statusSeed[s.id] = Math.random() > 0.35 ? 'online' : 'offline';
        });
        setOnlineStatus(prev => ({ ...prev, ...statusSeed }));

        if (location.state?.selectedChatId) {
          const target = dmsList.find((c: any) => c.id === location.state.selectedChatId);
          setSelectedChat(target || {
            id: location.state.selectedChatId,
            name: location.state.selectedSchoolName || 'School Admin'
          });
          setChatType('support');
          setShowSidebar(false);
        }
      } else {
        const data = res.data || {};
        const parsedDms = data.dms || (data.dm ? [data.dm] : []);
        setMyChats({
          group: data.group || null,
          dms: parsedDms,
          support: data.support || null
        });

        const statusSeed: Record<string, 'online' | 'offline'> = {};
        parsedDms.forEach((s: any) => {
          statusSeed[s.id] = Math.random() > 0.35 ? 'online' : 'offline';
        });
        setOnlineStatus(prev => ({ ...prev, ...statusSeed }));
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch my chats:', err);
      if (err?.response?.status === 404) {
        setMyChats({ group: null, dms: [], support: null });
      }
      setLoading(false);
    }
  };

  // Synchronize real-time chats onSnapshot with myChats state
  useEffect(() => {
    if (conversations.length === 0) return;
    
    setMyChats(prev => {
      const updatedGroup = prev.group
        ? (conversations.find((c: any) => c.id === prev.group.id) || prev.group)
        : null;

      const updatedDms = prev.dms.map((dm: any) => {
        const found = conversations.find((c: any) => c.id === dm.id);
        return found ? { ...dm, ...found } : dm;
      });

      const updatedSupport = prev.support
        ? (conversations.find((c: any) => c.id === prev.support.id) || prev.support)
        : null;

      return {
        group: updatedGroup,
        dms: updatedDms,
        support: updatedSupport
      };
    });
  }, [conversations]);

  // Real-time listener for discussions list (only runs when Firebase credentials match)
  useEffect(() => {
    if (!user || !firebaseReady) return;

    const q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = isSuper ? convos : convos.filter((c: any) =>
        c.id === user.schoolId ||
        c.id === `group_${user.schoolId}` ||
        c.id.startsWith(`dm_${user.schoolId}_`)
      );
      setConversations(filtered);
      setLoading(false);
    }, (error: any) => {
      if (error?.code === 'permission-denied') {
        setLoading(false);
        return;
      }
      console.warn('[FIRESTORE_CONVOS] Snapshot security check fallback:', error);
      setLoading(false);
      try {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      } catch (err) {
        // Log details but don't disrupt user loop
      }
    });

    return () => unsubscribe();
  }, [user?.id, isSuper, firebaseReady]);

  // Real-time listener for current chat's discussions subcollection
  useEffect(() => {
    const activeChatId = selectedChat?.id;
    if (!activeChatId || !firebaseReady) return;

    const q = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' }),
        isPending: doc.metadata.hasPendingWrites
      })) as any[];
      
      setMessages(msgs);
      
      // Clear out confirmed optimistic messages to prevent layout blinks
      const snapIds = new Set(msgs.map(m => m.id));
      setOptimisticMessages(prev => prev.filter(m => !snapIds.has(m.id)));
      
      scrollToBottom();
      
      // Update unread count to 0 when chat is opened and messages exist
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.senderId !== user.id) {
         updateDoc(doc(db, 'chats', activeChatId), {
           unreadCount: 0
         }).catch(() => {});
      }

      // Mark incoming unread messages as read in real-time
      let updatedAnyStatus = false;
      msgs.forEach((msg) => {
        if (msg.senderId !== user.id && !msg.isRead) {
          updatedAnyStatus = true;
          updateDoc(doc(db, 'chats', activeChatId, 'messages', msg.id), {
            isRead: true,
            isDelivered: true
          }).catch(() => {});
        }
      });

      if (updatedAnyStatus) {
        logChatAction('MESSAGE_READ', `Marked latest incoming messages as read in chat with id: ${activeChatId}`);
      }

    }, (error) => {
      console.warn('[FIRESTORE_MESSAGES] Unauthorized subcollection lookup:', error);
      try {
        handleFirestoreError(error, OperationType.LIST, `chats/${activeChatId}/messages`);
      } catch (err) {
        // Fail-safe error tracking logged internally
      }
    });

    return () => unsubscribe();
  }, [selectedChat?.id, user?.id, firebaseReady]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // Click outside listener for message option menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMessageMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Upload attachment and trigger state updates
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const max_size = 10 * 1024 * 1024; // 10MB limit
    if (file.size > max_size) {
      alert('File size exceeds the 10MB limit. Please upload a smaller file.');
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    
    let fileToUpload = file;
    if (type === 'image') {
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };
        fileToUpload = await imageCompression(file, options) as File;
      } catch (compressionError) {
        console.warn('Skipping image compression, uploading original:', compressionError);
      }
    }

    try {
      const res = await fileService.upload(fileToUpload, 'chats', (progress) => {
        setUploadProgress(progress);
      });
      
      setPendingAttachment({
        url: res.data.url,
        name: file.name,
        type: type,
        size: formatBytes(fileToUpload.size)
      });
      logChatAction('IMAGE_UPLOAD', `Prepared chat attachment: ${file.name}`);
    } catch (err: any) {
      console.warn('Fallback to Base64 FileReader Sandbox URL:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setPendingAttachment({
          url: reader.result as string,
          name: file.name,
          type: type,
          size: formatBytes(fileToUpload.size)
        });
      };
      reader.readAsDataURL(fileToUpload);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const removePendingAttachment = () => {
    setPendingAttachment(null);
  };

  const handleReply = (msg: any) => {
    setReplyingTo({
      id: msg.id,
      text: msg.text || '',
      senderName: msg.senderId === user.id ? 'You' : msg.senderName || 'Them',
      attachment: msg.attachment || null,
    });
    setActionSheetMsg(null);
  };

  // SEND MESSAGE ROUTINE WITH OPTIMISTIC AND OFFLINE COEXISTENCE
  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSendError('');

    if (chatType === 'group' && !selectedChat?.isOpen && user.id !== selectedChat?.adminId) {
      setSendError('Only the admin can send messages while the group is locked.');
      return;
    }

    // FIX 4: Validate that firebaseReady is truly ready before allowing sendMessage
    if (!firebaseReady) {
      console.warn('Firebase not ready yet, skipping send');
      return;
    }

    if (!newMessage.trim() && !pendingAttachment || !selectedChat) return;

    const messageText = newMessage.trim();
    const attachmentToSend = pendingAttachment;
    
    // Clear input fields immediately for instant visual response
    setNewMessage('');
    const replyContext = replyingTo;
    setReplyingTo(null);
    setPendingAttachment(null);
    setShowEmojiPicker(false);

    // Generate a secure, deterministic messaging document ID
    const msgId = doc(collection(db, 'chats', selectedChat.id, 'messages')).id;

    // Build immediate local optimistic payload
    const messagePayload: any = {
      id: msgId,
      messageId: msgId,
      conversationId: selectedChat.id,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      receiverId: isSuper ? selectedChat.id : 'SUPER',
      text: messageText,
      replyTo: replyContext ? {
        id: replyContext.id,
        text: replyContext.text,
        senderName: replyContext.senderName,
        attachment: replyContext.attachment || null,
      } : null,
      createdAt: { toDate: () => new Date() }, // Fast evaluation mock for local view (replaced by real Date on Firestore fetch)
      isEdited: false,
      isDeleted: false,
      isDelivered: false,
      isRead: false,
      isPending: true,
      deletedFor: []
    };

    if (attachmentToSend) {
      messagePayload.attachment = attachmentToSend;
    }

    // Set optimistic message in state immediately
    setOptimisticMessages(prev => [...prev, messagePayload]);
    scrollToBottom();

    // Send logic depending on network connectivity
    if (!navigator.onLine) {
      console.log('[CHAT_OFFLINE] Client offline. Queueing message immediately in persistent queue.');
      setOptimisticMessages(prev => prev.filter(m => m.id !== msgId));
      const failedPayload = {
        ...messagePayload,
        isFailed: true,
        isPending: false
      };
      setOfflineMessageQueue(prev => {
        const next = [...prev, failedPayload];
        saveOfflineMessages(next);
        return next;
      });
      scrollToBottom();
      return;
    }

    try {
      // Build real Firestore database payload with official Server Timestamps
      const firestorePayload = {
        ...messagePayload,
        createdAt: serverTimestamp()
      };
      delete firestorePayload.isPending;
      delete firestorePayload.id; // Let document ID represent the system ID

      // Atomically write message and merge conversation details to ensure reliable storage
      try {
        await setDoc(doc(db, 'chats', selectedChat.id, 'messages', msgId), firestorePayload);

        // Fire-and-forget notification trigger
        api.post(`/v1/chats/${selectedChat.id}/notify`, {
          senderName: user?.name,
          senderRole: user?.role,
          text: newMessage
        }).catch(() => {});
      } catch (writeErr: any) {
        // FIX 3: Add a console.error with the actual Firestore permission error message and code when sendMessage fails
        console.error('[FIRESTORE_WRITE_ERROR_DETAILS] Failed to write message to Firestore:', {
          code: writeErr?.code,
          message: writeErr?.message,
          error: writeErr
        });
        handleFirestoreError(writeErr, OperationType.WRITE, `chats/${selectedChat.id}/messages/${msgId}`);
        // FIX: Bug 2 - Re-throw message write error so the message send routine knows it failed and queues it offline.
        throw writeErr;
      }

      // FIX: Bug 2 - A failure writing the conversation metadata document does NOT abort the whole message send
      try {
        await setDoc(doc(db, 'chats', selectedChat.id), {
          lastMessage: messageText || `📎 [${attachmentToSend?.type === 'image' ? 'Image' : 'Attachment'}] ${attachmentToSend?.name}`,
          lastSenderId: user.id,
          updatedAt: serverTimestamp(),
          schoolId: selectedChat.id,
          schoolName: selectedChat.name || 'Unknown Partner',
          unreadCount: increment(1)
        }, { merge: true });
      } catch (statusErr) {
        // Only log and do not abort!
        console.error('[MESSAGES] Conversation metadata write failed (ignored to keep message send intact):', statusErr);
        handleFirestoreError(statusErr, OperationType.WRITE, `chats/${selectedChat.id}`);
      }

      // Succeeded! Note: We DO NOT filter out optimistic messages here anymore, 
      // they are safely filtered out in onSnapshot once received! This completely avoids the blink bug.
      logChatAction('MESSAGE_SENT', `Sent a WhatsApp-styled message to chat ID: ${selectedChat.id}`);

    } catch (err: any) {
      console.error('[CHAT_FAIL_DETAILS]', err);
      // Remove from temporary state and insert into persistent queue
      setOptimisticMessages(prev => prev.filter(m => m.id !== msgId));
      if (err?.code === 'permission-denied') {
        setSendError('Message failed: permission denied. Please refresh the page.');
      } else {
        const failedPayload = {
          ...messagePayload,
          isFailed: true,
          isPending: false
        };
        setOfflineMessageQueue(prev => {
          const next = [...prev, failedPayload];
          saveOfflineMessages(next);
          return next;
        });
      }
    }
  };

  const retrySendMessage = async (failedMsg: any) => {
    // Evict from persistent queue first to handle retry run
    setOfflineMessageQueue(prev => {
      const next = prev.filter(m => m.id !== failedMsg.id);
      saveOfflineMessages(next);
      return next;
    });

    // Populate temporary visual pending status 
    const pendingMsg = {
      ...failedMsg,
      isPending: true,
      isFailed: false,
      createdAt: { toDate: () => new Date() }
    };
    setOptimisticMessages(prev => [...prev, pendingMsg]);
    scrollToBottom();

    try {
      const firestorePayload = {
        messageId: failedMsg.messageId,
        conversationId: failedMsg.conversationId,
        senderId: failedMsg.senderId,
        senderName: failedMsg.senderName,
        senderRole: failedMsg.senderRole,
        receiverId: failedMsg.receiverId,
        text: failedMsg.text || '',
        attachment: failedMsg.attachment || null,
        createdAt: serverTimestamp(),
        isEdited: false,
        isDeleted: false,
        isDelivered: true,
        isRead: false,
        deletedFor: []
      };

      try {
        await setDoc(doc(db, 'chats', selectedChat.id, 'messages', failedMsg.id), firestorePayload);
      } catch (writeErr) {
        handleFirestoreError(writeErr, OperationType.WRITE, `chats/${selectedChat.id}/messages/${failedMsg.id}`);
        // FIX: Bug 2 - Re-throw message write error so retry knows it failed
        throw writeErr;
      }

      // FIX: Bug 2 - A failure writing the conversation metadata document does NOT abort the whole message retry
      try {
        await setDoc(doc(db, 'chats', selectedChat.id), {
          lastMessage: failedMsg.text || '📎 Sent attachment',
          lastSenderId: user.id,
          updatedAt: serverTimestamp(),
          schoolId: selectedChat.id,
          schoolName: selectedChat.name || 'Unknown Partner',
          unreadCount: increment(1)
        }, { merge: true });
      } catch (statusErr) {
        // Only log and do not abort!
        console.error('[MESSAGES] Conversation metadata retry write failed (ignored to keep message send intact):', statusErr);
        handleFirestoreError(statusErr, OperationType.WRITE, `chats/${selectedChat.id}`);
      }

      // Succeeded! Defer cleanup to snapshot
      logChatAction('MESSAGE_SENT', `Retried and successfully sent WhatsApp message.`);
    } catch (err) {
      console.error('[RETRY_FAILED_DETAILS]', err);
      setOptimisticMessages(prev => prev.filter(m => m.id !== failedMsg.id));
      setOfflineMessageQueue(prev => {
        const next = [...prev, { ...failedMsg, isFailed: true }];
        saveOfflineMessages(next);
        return next;
      });
    }
  };

  // Connect background auto-retry for offline message queue
  const processOfflineQueue = async () => {
    if (offlineMessageQueue.length === 0 || !navigator.onLine || !selectedChat) return;
    console.log('[AUTO-SYNC] Processing offline queued messages...');
    const queueToProcess = [...offlineMessageQueue];
    for (const msg of queueToProcess) {
      if (msg.conversationId === selectedChat.id) {
        await retrySendMessage(msg);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('online', processOfflineQueue);
    return () => window.removeEventListener('online', processOfflineQueue);
  }, [offlineMessageQueue, selectedChat]);

  // FIX 2: Retry offline queue on page load when firebase becomes ready, not just on online event
  useEffect(() => {
    if (firebaseReady && selectedChat?.id) {
      processOfflineQueue();
    }
  }, [firebaseReady, selectedChat?.id]);

  // EDIT MESSAGE
  const handleStartEdit = (msg: any) => {
    setEditingMessageId(msg.id);
    setEditText(msg.text || '');
    setActiveMessageMenuId(null);
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!editText.trim()) return;
    try {
      await updateDoc(doc(db, 'chats', selectedChat.id, 'messages', msgId), {
        text: editText,
        isEdited: true,
        editedAt: new Date().toISOString()
      });
      setEditingMessageId(null);
      logChatAction('MESSAGE_EDIT', `Edited message ID: ${msgId} content.`);
    } catch (err) {
      console.error('Failed to update discussion text:', err);
    }
  };

  // DELETE FOR EVERYONE
  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Are you sure you want to delete this message for everyone?')) return;
    try {
      await updateDoc(doc(db, 'chats', selectedChat.id, 'messages', msgId), {
        isDeleted: true,
        text: '🚫 This message was deleted',
        attachment: null
      });
      logChatAction('MESSAGE_DELETE_EVERYONE', `Soft deleted message ID: ${msgId} for everyone.`);
    } catch (err) {
      console.error('Failed to delete chat record:', err);
    }
  };

  // DELETE FOR ME (Appends userID to isDeleted local filter)
  const handleDeleteForMe = async (msg: any) => {
    try {
      const currentDeletedFor = msg.deletedFor || [];
      await updateDoc(doc(db, 'chats', selectedChat.id, 'messages', msg.id), {
        deletedFor: [...currentDeletedFor, user.id]
      });
      logChatAction('MESSAGE_DELETE_FOR_ME', `Deleted message ID: ${msg.id} for self.`);
    } catch (err) {
      console.error('Failed to hide conversation line for self:', err);
    }
  };

  // PHYSICAL/HARD DELETE MESSAGE
  const deleteMessage = async (messageId: string) => {
    if (!messageId) return;
    const msg = [
      ...messages,
      ...optimisticMessages,
      ...offlineMessageQueue
    ].find(m => m.id === messageId);

    if (!msg || msg.senderId !== user?.id) {
      console.error('Only the sender can delete this message.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'chats', selectedChat.id, 'messages', messageId));
      logChatAction('MESSAGE_HARD_DELETE', `Hard deleted message ID: ${messageId}`);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const appendEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const getChatOnlineStatus = (chatId: string) => {
    return onlineStatus[chatId] || 'offline';
  };

  // Get active list of conversations or filter list
  const conversationsToRender = conversations.filter(c => 
    c.schoolName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSchoolsList = schools.filter(s => 
    (s.name || s.schoolName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute final message listing with "Delete for me" filtration and unique de-duplication applied
  const visibleMessages = [
    ...messages,
    ...optimisticMessages,
    ...offlineMessageQueue.filter(m => m.conversationId === selectedChat?.id)
  ].filter(
    (m, index, self) => 
      // Filter out duplicate IDs (e.g., if a message has already been loaded from Firestore snap or is sending)
      self.findIndex(t => t.id === m.id) === index
  ).filter(
    m => !m.deletedFor?.includes(user.id)
  );

  const getMessageGroup = (index: number) => {
    const msg = visibleMessages[index];
    const prev = visibleMessages[index - 1];
    const next = visibleMessages[index + 1];
    const isFirstInGroup = !prev || prev.senderId !== msg.senderId || 
      getMessageDate(msg.createdAt).toDateString() !== getMessageDate(prev.createdAt).toDateString();
    const isLastInGroup = !next || next.senderId !== msg.senderId ||
      getMessageDate(next.createdAt).toDateString() !== getMessageDate(msg.createdAt).toDateString();
    return { isFirstInGroup, isLastInGroup };
  };

  const chatDisplayName = selectedChat 
    ? (selectedChat.name || selectedChat.teacherName || (chatType === 'support' ? 'Super Admin Support' : 'Chat')) 
    : '';

  if (!user) {
    return (
      <div className="h-screen w-screen fixed inset-0 flex items-center justify-center bg-gray-100">
        <Loader2 className="animate-spin text-blue-600" size={24} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen fixed inset-0 flex bg-gray-100 overflow-hidden animate-in fade-in duration-500">
      
      {/* Sidebar - Dynamically responsive */}
      {(showSidebar || window.innerWidth >= 1024) ? (
        <div className={`w-full lg:w-[380px] border-r border-gray-200 flex flex-col bg-white overflow-hidden shrink-0 ${!showSidebar ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* My Profile Section */}
          <div className="p-4 bg-gray-50 flex items-center justify-between border-b border-gray-100">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shadow ring-2 ring-blue-500/10">
                 {user.name.charAt(0)}
               </div>
               <div>
                 <h4 className="font-extrabold text-[#1c1e21] text-xs uppercase tracking-wider">{user.name}</h4>
                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-0.5">{user.role?.replace(/_/g, ' ')}</p>
               </div>
             </div>
             <div>
                <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 border border-emerald-100">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Active
                </span>
             </div>
          </div>
          
          {/* Discussion Search Bar */}
          <div className="p-3 bg-white">
             <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold" />
                <input 
                  type="text" 
                  placeholder="Search chats or schools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-100 border-transparent rounded-xl text-xs font-semibold text-gray-700 placeholder:text-gray-400 outline-none hover:bg-gray-200/50 transition-colors"
                />
             </div>
          </div>

          {/* Conversations Scroll view */}
          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar divide-y divide-gray-50">
             {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="animate-spin text-blue-600 animate-duration-1000" size={24} />
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Awaiting cloud connection...</span>
                </div>
             ) : isSuper ? (
                // SUPER ADMIN scenario
                <>
                  {user.role === 'SUPER_ADMIN' && !backfillDone && (
                    <button
                      onClick={async () => {
                        try {
                          await api.post('/v1/chats/backfill-school-chats');
                          setBackfillDone(true);
                          window.location.reload();
                        } catch (err) {
                          console.error('Backfill failed:', err);
                        }
                      }}
                      className="mx-4 mt-3 mb-1 w-full px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
                    >
                      Initialize School Chats
                    </button>
                  )}
                  {myChats.dms.length === 0 ? (
                    <div className="py-20 text-center px-4">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">No support chats found</p>
                    </div>
                  ) : (
                    myChats.dms
                      .filter((chat: any) => 
                        (chat.schoolName || chat.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (chat.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((chat: any) => {
                        const isSelected = selectedChat?.id === chat.id;
                        const status = getChatOnlineStatus(chat.id);
                        const unreadCount = chat.unreadCountAdmin || chat.unreadCount || 0;
                        return (
                          <button 
                            key={chat.id}
                            onClick={() => {
                               setSelectedChat(chat);
                               setChatType('support');
                               setShowSidebar(false);
                            }}
                            className={`w-full p-4 flex items-center gap-4 transition-all text-left ${
                              isSelected ? 'bg-blue-50/50 hover:bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <div className="w-11 h-11 bg-gradient-to-tr from-blue-50 to-indigo-100 text-blue-600 border border-indigo-200/50 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm">
                                {(chat.schoolName || chat.name || '?').charAt(0)}
                              </div>
                              {status === 'online' && (
                                <span className="absolute -bottom-1 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-gray-900 text-xs truncate uppercase tracking-wider">{chat.schoolName || chat.name}</span>
                                {chat.updatedAt && (
                                  <span className="text-[8px] text-gray-400 font-semibold whitespace-nowrap uppercase">
                                    {chat.updatedAt.toDate ? chat.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                 <div className="text-[11px] text-gray-400 truncate pr-4 font-normal">
                                   {chat.lastMessage || 'No messages yet'}
                                 </div>
                                 {unreadCount > 0 && !isSelected && (
                                   <div className="bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg shrink-0">
                                     {unreadCount}
                                   </div>
                                 )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                  )}
                </>
             ) : (
                // SCHOOL_ADMIN and TEACHER three sections sidebar
                <div className="flex flex-col">
                  {/* SECTION 1 - Support (SCHOOL_ADMIN only) */}
                  {user.role === 'SCHOOL_ADMIN' && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-y border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#1a1c1e] transition-colors">Support</span>
                      </div>
                      {myChats.support ? (
                        <button 
                          onClick={() => {
                             setSelectedChat(myChats.support);
                             setChatType('support');
                             setShowSidebar(false);
                          }}
                          className={`w-full p-4 flex items-center gap-4 transition-all text-left ${
                            selectedChat?.id === myChats.support.id ? 'bg-blue-50/50 hover:bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 bg-gradient-to-tr from-orange-50 to-amber-100 text-orange-600 border border-amber-200/50 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm">
                              🛡️
                            </div>
                            <span className="absolute -bottom-1 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-gray-900 text-xs truncate uppercase tracking-wider">Super Admin Support</span>
                              {myChats.support.updatedAt && (
                                <span className="text-[8px] text-gray-400 font-semibold whitespace-nowrap uppercase">
                                  {myChats.support.updatedAt.toDate ? myChats.support.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                               <div className="text-[11px] text-gray-400 truncate pr-4 font-normal">
                                 {myChats.support.lastMessage || 'Contact system administrators'}
                               </div>
                               {myChats.support.unreadCount > 0 && selectedChat?.id !== myChats.support.id && (
                                 <div className="bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg shrink-0">
                                   {myChats.support.unreadCount}
                                 </div>
                               )}
                            </div>
                          </div>
                        </button>
                      ) : (
                        <div className="p-4 text-center">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No active support chat</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* SECTION 2 - Group Chat */}
                  {(user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER') && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-y border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#1a1c1e] transition-colors">Group Chat</span>
                      </div>
                      {myChats.group ? (
                        <button 
                          onClick={() => {
                             setSelectedChat(myChats.group);
                             setChatType('group');
                             setShowSidebar(false);
                          }}
                          className={`w-full p-4 flex items-center gap-4 transition-all text-left ${
                            selectedChat?.id === myChats.group.id ? 'bg-blue-50/50 hover:bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 bg-gradient-to-tr from-purple-50 to-indigo-100 text-purple-600 border border-indigo-200/50 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm animate-in fade-in-50">
                              👥
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-extrabold text-gray-900 text-xs truncate uppercase tracking-wider">
                                  {myChats.group.name || 'Staff Group'}
                                </span>
                                {myChats.group.isOpen === false && (
                                  <span title="Locked: Admins only">
                                    <Lock size={12} className="text-gray-400 shrink-0" />
                                  </span>
                                )}
                                {myChats.group.adminId === user.id && (
                                  <span className="text-[8px] font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border border-blue-200">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100 shrink-0 font-mono">
                                {myChats.group.memberCount || myChats.group.memberIds?.length || 0} members
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                               <div className="text-[11px] text-gray-400 truncate pr-4 font-normal">
                                 {myChats.group.lastMessage || 'No messages yet'}
                               </div>
                               {myChats.group.unreadCount > 0 && selectedChat?.id !== myChats.group.id && (
                                 <div className="bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg shrink-0">
                                   {myChats.group.unreadCount}
                                 </div>
                               )}
                            </div>
                          </div>
                        </button>
                      ) : (
                        <div className="p-4 text-center">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No active group chat</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* SECTION 3 - Direct Messages */}
                  <>
                    <div className="px-4 py-2 bg-gray-50 border-y border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#1a1c1e] transition-colors">Direct Messages</span>
                    </div>
                    {myChats.dms && myChats.dms.length > 0 ? (
                      myChats.dms
                        .filter((dm: any) => 
                          (dm.teacherName || dm.name || 'Staff Member').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (dm.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((dm: any) => {
                          const isSelected = selectedChat?.id === dm.id;
                          const status = getChatOnlineStatus(dm.id);
                          const displayName = dm.teacherName || dm.name || 'Staff Member';
                          const unreadCount = dm.unreadCount || 0;
                          return (
                            <button 
                              key={dm.id}
                              onClick={() => {
                                 setSelectedChat(dm);
                                 setChatType('dm');
                                 setShowSidebar(false);
                              }}
                              className={`w-full p-4 flex items-center gap-4 transition-all text-left ${
                                isSelected ? 'bg-blue-50/50 hover:bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="relative shrink-0">
                                <div className="w-11 h-11 bg-gradient-to-tr from-emerald-50 to-teal-100 text-emerald-600 border border-teal-200/50 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm">
                                  {displayName.charAt(0)}
                                </div>
                                {status === 'online' && (
                                  <span className="absolute -bottom-1 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                  <span className="font-extrabold text-gray-900 text-xs truncate uppercase tracking-wider">{displayName}</span>
                                  {dm.updatedAt && (
                                    <span className="text-[8px] text-gray-400 font-semibold whitespace-nowrap uppercase">
                                      {dm.updatedAt.toDate ? dm.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                   <div className="text-[11px] text-gray-400 truncate pr-4 font-normal">
                                     {dm.lastMessage || 'Send a direct message'}
                                   </div>
                                   {unreadCount > 0 && !isSelected && (
                                     <div className="bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg shrink-0">
                                       {unreadCount}
                                     </div>
                                   )}
                                </div>
                              </div>
                            </button>
                          );
                        })
                    ) : (
                      <div className="p-4 text-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No direct messages</span>
                      </div>
                    )}
                  </>
                </div>
             )}
          </div>
        </div>
      ) : null}

      {/* Main Discussion Console */}
      <div className={`flex-1 flex flex-col relative bg-[#efeae2] ${showSidebar ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Ambient Subtle Diagonal Lines Pattern */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dust.png")' }} />

        {!selectedChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white relative z-10 animate-in fade-in duration-300">
             <div className="relative mb-6">
               <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow">
                 <MessageSquare size={28} className="animate-pulse" />
               </div>
               <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
             </div>
             <h3 className="text-sm font-black text-[#1c1e21] uppercase tracking-wider">Support desk discussions</h3>
             <p className="text-xs text-gray-400 mt-2 max-w-sm leading-relaxed font-bold">
               Connect with school administrators dynamically. Query operational records, address support inquiries, or view active logs.
             </p>
          </div>
        ) : (
          <>
            {/* Header section */}
            <div className="p-3.5 bg-white border-b border-gray-150 flex items-center justify-between relative z-10 shadow-sm">
               <div className="flex items-center gap-3">
                  {!showSidebar && (
                    <button onClick={() => setShowSidebar(true)} className="lg:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center font-bold shadow text-xs uppercase">
                      {chatDisplayName.charAt(0)}
                    </div>
                    {getChatOnlineStatus(selectedChat.id) === 'online' && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#1c1e21] text-xs leading-tight uppercase tracking-wider">{chatDisplayName}</h4>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider block mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {getChatOnlineStatus(selectedChat.id) === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
               </div>
               
               <div className="flex items-center gap-2">
                  {chatType === 'group' && user.role === 'SCHOOL_ADMIN' && (
                    <>
                      {/* Lock / Unlock Toggle button */}
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.patch(`/v1/chats/group/${user.schoolId}/toggle-open`);
                            setSelectedChat((prev: any) => ({ ...prev, isOpen: res.data.isOpen }));
                            // Also refresh my-chats state
                            fetchMyChats();
                          } catch (err) {
                            console.error('Failed to toggle open:', err);
                          }
                        }}
                        className={`p-2 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95 ${
                          selectedChat.isOpen === false 
                            ? 'bg-rose-50 border border-rose-150 text-rose-600 hover:bg-rose-100' 
                            : 'bg-emerald-50 border border-emerald-150 text-emerald-600 hover:bg-emerald-100'
                        }`}
                        title={selectedChat.isOpen === false ? "Unlock Group (Allow anyone to send messages)" : "Lock Group (Admins only)"}
                      >
                        {selectedChat.isOpen === false ? '🔒 Locked' : '🌐 Open'}
                      </button>

                      {/* Manage Members Toggle Button */}
                      <button
                        onClick={() => {
                          setShowMembersModal(!showMembersModal);
                        }}
                        className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200/50 rounded-xl text-xs font-bold text-gray-600 transition-all duration-150 flex items-center gap-1 shadow-sm hover:scale-105 active:scale-95"
                      >
                        👥 Members ({selectedChat.memberCount || selectedChat.memberIds?.length || 0})
                      </button>
                    </>
                  )}
                  <span className="text-[9px] font-bold px-2.5 py-1 bg-gray-100 rounded-full text-gray-500 uppercase tracking-wider font-mono border border-gray-200/50">
                    ID: {selectedChat.id.slice(0, 8)}
                  </span>
                  {chatType === 'group' && user.id === selectedChat?.adminId && (
                    <button
                      onClick={() => setShowGroupSettings(true)}
                      className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                      title="Group Settings"
                    >
                      <Settings size={16} />
                    </button>
                  )}
               </div>
            </div>

            {/* Bubble conversation display window */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1 relative z-10 custom-scrollbar">
              {visibleMessages.length === 0 ? (
                <div className="flex justify-center py-20">
                   <div className="bg-white/80 border border-gray-100 rounded-2xl p-4 max-w-xs text-center shadow-sm">
                      <p className="text-xs text-gray-500 font-bold">No messages yet. Send a message to get started.</p>
                   </div>
                </div>
              ) : (
                visibleMessages.map((msg, i) => {
                  const isMine = msg.senderId === user.id;
                  const isMenuOpen = activeMessageMenuId === msg.id;
                  const isFailed = msg.isFailed;
                  const { isFirstInGroup, isLastInGroup } = getMessageGroup(i);

                  const showDate = i === 0 || (() => {
                    const currentD = getMessageDate(msg.createdAt);
                    const prevD = getMessageDate(visibleMessages[i-1]?.createdAt);
                    return currentD.toDateString() !== prevD.toDateString();
                  })();
                  
                  return (
                    <React.Fragment key={msg.id || i}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                           <div className="bg-white/90 border border-gray-150 px-3 py-1 rounded-xl text-[9px] font-bold text-gray-400 uppercase tracking-widest shadow-sm">
                             {getMessageDate(msg.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                           </div>
                        </div>
                      )}

                      <div className={isFirstInGroup ? 'mt-3' : 'mt-0.5'}>
                        <div
                          className={`relative transition-colors duration-150 ${isSelectMode && selectedMessageIds.has(msg.id) ? 'bg-blue-50/60' : ''}`}
                          onClick={() => isSelectMode && toggleSelectMessage(msg.id)}
                        >
                          {isSelectMode && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                selectedMessageIds.has(msg.id) 
                                  ? 'bg-blue-600 border-blue-600' 
                                  : 'border-gray-400 bg-white'
                              }`}>
                                {selectedMessageIds.has(msg.id) && <Check size={11} className="text-white" />}
                              </div>
                            </div>
                          )}
                          <div className={`${isSelectMode ? 'pl-11 pr-2 pointer-events-none select-none' : ''}`}>
                            <div
                              onTouchStart={(e) => {
                                if (isSelectMode) return;
                                const x = e.touches[0].clientX;
                                setSwipeStartX(prev => ({ ...prev, [msg.id]: x }));
                                const timer = setTimeout(() => {
                                  setActionSheetMsg(msg);
                                }, 500);
                                setLongPressTimer(timer);
                              }}
                              onTouchMove={(e) => {
                                if (isSelectMode) return;
                                if (longPressTimer) {
                                  clearTimeout(longPressTimer);
                                  setLongPressTimer(null);
                                }
                                const startX = swipeStartX[msg.id] || 0;
                                const diff = e.touches[0].clientX - startX;
                                if (diff > 0 && diff < 80) {
                                  setSwipeDelta(prev => ({ ...prev, [msg.id]: diff }));
                                }
                              }}
                              onTouchEnd={() => {
                                if (isSelectMode) return;
                                if (longPressTimer) {
                                  clearTimeout(longPressTimer);
                                  setLongPressTimer(null);
                                }
                                const delta = swipeDelta[msg.id] || 0;
                                if (delta > 45) handleReply(msg);
                                setSwipeDelta(prev => ({ ...prev, [msg.id]: 0 }));
                              }}
                              style={{
                                transform: `translateX(${swipeDelta[msg.id] || 0}px)`,
                                transition: swipeDelta[msg.id] ? 'none' : 'transform 0.2s ease'
                              }}
                            >
                          <div className={`flex items-start gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {!isMine && (
                              isLastInGroup ? (
                                <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-[10px] shadow-sm uppercase shrink-0">
                                  {msg.senderName?.charAt(0) || 'A'}
                                </div>
                              ) : (
                                <div className="w-7 h-7 shrink-0" />
                              )
                            )}

                            <div className="relative group max-w-[75%] md:max-w-[65%]">

                          {/* Chat bubble body card with authentic WhatsApp shades */}
                          <div className={`px-3 py-2 shadow-sm text-xs relative inline-block max-w-full ${
                            isMine 
                              ? isFailed 
                                ? 'bg-rose-100 border border-rose-200 text-rose-950 rounded-2xl' 
                                : `bg-[#d9fdd3] border border-[#c4e9be] text-gray-900 rounded-2xl ${isFirstInGroup ? 'rounded-tr-none' : ''}`
                              : `bg-white border border-gray-200/50 text-gray-900 rounded-2xl ${isFirstInGroup ? 'rounded-tl-none' : ''}`
                          }`}>
                            {msg.replyTo && (
                              <div className="mb-2 px-2 py-1.5 rounded-xl border-l-4 border-blue-500 bg-black/[0.04] text-[10px]">
                                <p className="font-bold text-blue-600 uppercase tracking-wide">{msg.replyTo.senderName}</p>
                                <p className="text-gray-600 truncate mt-0.5">
                                  {msg.replyTo.attachment ? `📎 ${msg.replyTo.attachment.name}` : msg.replyTo.text}
                                </p>
                              </div>
                            )}

                            {!isMine && isFirstInGroup && (
                              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                                {msg.senderName}
                              </div>
                            )}

                            {editingMessageId === msg.id ? (
                              <div className="py-1 space-y-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full text-xs font-semibold p-2 border border-blue-500 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  rows={2}
                                />
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-2 py-1 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => handleSaveEdit(msg.id)}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {msg.attachment && (
                                  <div className="mb-2 rounded-xl overflow-hidden border border-black/5 bg-black/[0.01] p-1">
                                    {msg.attachment.type === 'image' ? (
                                      <div 
                                        onClick={() => setPreviewImage({ url: msg.attachment.url, name: msg.attachment.name })}
                                        className="relative group/att cursor-pointer"
                                      >
                                        <img 
                                          src={msg.attachment.url} 
                                          alt={msg.attachment.name} 
                                          className="max-h-[220px] rounded-lg object-cover w-full transition-all group-hover/att:opacity-90"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
                                          <p className="text-[10px] font-bold truncate">{msg.attachment.name}</p>
                                          <span className="text-[9px] opacity-75">{msg.attachment.size}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <button 
                                        type="button"
                                        onClick={() => handleFileDownload(msg.attachment.url, msg.attachment.name)}
                                        className="w-full flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors text-left"
                                        disabled={downloadingUrls[msg.attachment.url]}
                                      >
                                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                          {downloadingUrls[msg.attachment.url] ? (
                                            <Loader2 size={16} className="animate-spin text-blue-600" />
                                          ) : (
                                            <FileText size={16} />
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[10px] font-semibold text-gray-800 truncate">{msg.attachment.name}</p>
                                          <p className="text-[9px] text-gray-400 font-bold">
                                            {downloadingUrls[msg.attachment.url] ? 'Downloading...' : (msg.attachment.size || 'Attachment')}
                                          </p>
                                        </div>
                                      </button>
                                    )}
                                  </div>
                                )}

                                <p className={`leading-relaxed whitespace-pre-wrap pr-4 text-xs font-semibold ${msg.isDeleted ? 'italic text-gray-400' : 'text-gray-950'}`}>
                                  {msg.text}
                                </p>

                                {confirmDeleteId === msg.id && (
                                  <div className="mt-2 pt-2 border-t border-black/10 flex flex-wrap items-center justify-end gap-2 text-[10px]">
                                    <span className="text-red-600 font-bold mr-auto">Delete this message?</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(null);
                                      }}
                                      className="px-2 py-1 bg-gray-105 hover:bg-gray-200 text-gray-700 font-bold rounded transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMessage(confirmDeleteId);
                                        setConfirmDeleteId(null);
                                      }}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-colors cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Status and Clock markings */}
                            <div className="flex items-center justify-end gap-1 mt-1 text-right w-full">
                               {msg.isEdited && !msg.isDeleted && (
                                 <span className="text-[8px] font-bold text-orange-500 uppercase tracking-wider mr-1">
                                   Edited
                                 </span>
                               )}
                               <span className="text-[9px] text-gray-400 font-mono font-medium whitespace-nowrap uppercase">
                                 {getMessageDate(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                               {isMine && !isFailed && (
                                 <span className="shrink-0 flex items-center ml-0.5">
                                   {msg.isPending ? (
                                     <span title="Sending..."><Check size={13} className="text-gray-300/60 animate-pulse" /></span>
                                   ) : msg.isRead ? (
                                     <span title="Read"><CheckCheck size={13} className="text-[#53bdeb]" /></span>
                                   ) : msg.isDelivered ? (
                                     <span title="Delivered"><CheckCheck size={13} className="text-gray-400" /></span>
                                   ) : (
                                     <span title="Sent"><Check size={13} className="text-gray-400" /></span>
                                   )}
                                 </span>
                               )}
                               {isFailed && (
                                 <button 
                                   onClick={() => retrySendMessage(msg)}
                                   className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider shadow"
                                   title="Failed, click to retry"
                                 >
                                   <AlertCircle size={8} />
                                   Retry
                                 </button>
                               )}
                            </div>
                          </div>
                        </div>
                        </div>
                      </div>
                      </div>
                      </div>
                      </div>
                    </React.Fragment>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Preparation widget */}
            {pendingAttachment && (
              <div className="px-5 py-3.5 bg-white border-t border-gray-150 relative z-20 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                  {pendingAttachment.type === 'image' ? (
                     <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-100">
                       <img src={pendingAttachment.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     </div>
                  ) : (
                     <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center animate-bounce">
                       <FileText size={20} />
                     </div>
                  )}
                  <div>
                    <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded uppercase tracking-wider">
                      Attachment prepared
                    </span>
                    <p className="text-xs font-bold text-[#1a1c1e] truncate max-w-[200px] mt-0.5">{pendingAttachment.name}</p>
                  </div>
                </div>
                <button 
                  onClick={removePendingAttachment}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Loading stream progress bar */}
            {uploading && (
              <div className="px-6 py-3 bg-white border-t border-gray-150 flex items-center gap-3 relative z-20">
                <Loader2 className="animate-spin text-blue-600 shrink-0" size={15} />
                <div className="flex-1">
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Uploading attachment: {uploadProgress || 15}%</p>
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${uploadProgress || 15}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* FIX 5: Show small yellow warning banner when firebaseReady is false */}
            {!firebaseReady && (
              <div id="reconnecting-warning-banner" className="px-5 py-3 bg-amber-50 border-t border-amber-200/60 flex flex-col gap-1 relative z-20 text-amber-800 animate-pulse">
                <div className="flex items-center gap-2.5">
                  {firebaseTimeout ? (
                    <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                      Could not connect to messaging server. Please refresh.
                    </span>
                  ) : (
                    <>
                      <Loader2 className="animate-spin text-amber-600 shrink-0" size={14} />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Reconnecting to messaging server...
                      </span>
                    </>
                  )}
                </div>
                {debugError && (
                  <div className="text-red-600 text-[10px] font-mono break-all pl-6">
                    {debugError}
                  </div>
                )}
              </div>
            )}

            {/* Sticky Input Footer */}
            <div className="p-3 bg-white border-t border-gray-200/50 relative z-20">
               {isSelectMode ? (
                 <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-150 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-250">
                   <button onClick={exitSelectMode} type="button" className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">
                     <X size={18} /> Cancel
                   </button>
                   <span className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">
                     {selectedMessageIds.size} selected
                   </span>
                   <button
                     type="button"
                     disabled={selectedMessageIds.size === 0}
                     onClick={async () => {
                       const allMsgs = [...messages, ...optimisticMessages, ...offlineMessageQueue];
                       for (const id of selectedMessageIds) {
                         const m = allMsgs.find(item => item.id === id);
                         if (m) {
                           await handleDeleteForMe(m);
                         } else {
                           await handleDeleteForMe({ id });
                         }
                       }
                       exitSelectMode();
                     }}
                     className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                       selectedMessageIds.size > 0
                         ? 'bg-rose-600 text-white hover:bg-rose-700 shadow shadow-rose-100'
                         : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                     }`}
                   >
                     <Trash2 size={16} /> Delete
                   </button>
                 </div>
               ) : (
                 <>
                   {chatType === 'group' && !selectedChat?.isOpen && user.id !== selectedChat?.adminId ? (
                     <div className="px-4 py-3 bg-gray-100 rounded-xl text-xs text-gray-450 font-semibold text-center">
                       🔒 Only the admin can send messages
                     </div>
                   ) : (
                     <>
                       {replyingTo && (
                     <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100 rounded-t-xl mb-2">
                       <div className="flex items-center gap-2 min-w-0">
                         <div className="w-0.5 h-8 bg-blue-500 rounded-full shrink-0" />
                         <div className="min-w-0">
                           <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider text-left">↩ Replying to {replyingTo.senderName}</p>
                           <p className="text-[11px] text-gray-500 truncate text-left">
                             {replyingTo.attachment ? `📎 ${replyingTo.attachment.name}` : replyingTo.text}
                           </p>
                         </div>
                       </div>
                       <button
                         type="button"
                         onClick={() => setReplyingTo(null)}
                         className="p-1.5 text-gray-400 hover:text-gray-700 shrink-0 cursor-pointer"
                       >
                         <X size={14} />
                       </button>
                     </div>
                   )}

                   {showEmojiPicker && (
                     <div className="absolute bottom-[72px] left-4 bg-white border border-gray-150 rounded-2xl shadow-xl p-3 z-50 w-72 animate-in slide-in-from-bottom-2 duration-200">
                       <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                         <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Insert symbol</span>
                         <button onClick={() => setShowEmojiPicker(false)} className="text-gray-400 hover:text-gray-600">
                           <X size={13} />
                         </button>
                       </div>
                       <div className="grid grid-cols-7 gap-2">
                         {EMOJI_LIST.map(emoji => (
                           <button
                             key={emoji.name}
                             onClick={() => appendEmoji(emoji.char)}
                             className="text-lg p-1 hover:bg-gray-150 rounded-xl transition-all hover:scale-110"
                             type="button"
                           >
                             {emoji.char}
                           </button>
                         ))}
                       </div>
                     </div>
                   )}

                   <form onSubmit={sendMessage} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-gray-400 shrink-0">
                         <button
                           type="button" 
                           onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                           className={`p-2 hover:bg-gray-100 rounded-xl hover:text-[#1a1c1e] transition-colors ${showEmojiPicker ? 'text-blue-600 bg-blue-50' : ''}`}
                           title="Insert emoji"
                         >
                           <Smile size={19} />
                         </button>

                         <button
                           type="button" 
                           onClick={() => imageInputRef.current?.click()}
                           className="p-2 hover:bg-gray-100 rounded-xl hover:text-[#1a1c1e] transition-colors"
                           title="Attach image"
                         >
                            <ImageIcon size={19} />
                         </button>
                         <input 
                           type="file" 
                           ref={imageInputRef} 
                           onChange={(e) => handleFileChange(e, 'image')} 
                           accept="image/*" 
                           className="hidden" 
                         />

                         <button
                           type="button" 
                           onClick={() => fileInputRef.current?.click()}
                           className="p-2 hover:bg-gray-100 rounded-xl hover:text-[#1a1c1e] transition-colors"
                           title="Attach PDF or document"
                         >
                           <Paperclip size={18} />
                         </button>
                         <input 
                           type="file" 
                           ref={fileInputRef} 
                           onChange={(e) => handleFileChange(e, 'file')} 
                           accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" 
                           className="hidden" 
                         />
                      </div>

                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2.5 bg-gray-100 border-transparent rounded-xl text-xs font-semibold text-gray-700 placeholder:text-gray-400 focus:bg-gray-100 focus:ring-1 focus:ring-blue-300 outline-none transition-colors"
                      />

                      <button 
                        type="submit"
                        disabled={!newMessage.trim() && !pendingAttachment}
                        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all ${
                          newMessage.trim() || pendingAttachment 
                            ? 'bg-blue-600 text-white shadow hover:bg-blue-700' 
                            : 'bg-gray-150 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Send size={15} />
                      </button>
                   </form>
                   {sendError && (
                     <p className="text-red-600 text-[10px] mt-1.5 font-bold animate-pulse px-1">
                       {sendError}
                     </p>
                   )}
                     </>
                   )}
                 </>
               )}
            </div>
          </>
        )}
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-sm">
          {/* Top-right close button */}
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer z-51 focus:outline-none"
            title="Close"
          >
            <X size={24} />
          </button>

          {/* Centered image container */}
          <div className="relative max-w-full max-h-[80vh] flex items-center justify-center">
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl transition-transform"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Bottom-center download button and filename */}
          <div className="absolute bottom-6 flex flex-col items-center gap-2">
            <p className="text-white text-xs font-semibold max-w-[300px] truncate">{previewImage.name}</p>
            <button
              type="button"
              onClick={() => handleFileDownload(previewImage.url, previewImage.name)}
              disabled={downloadingUrls[previewImage.url]}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
            >
              {downloadingUrls[previewImage.url] ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Save to phone / Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {actionSheetMsg && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => setActionSheetMsg(null)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-4 pb-8 space-y-1 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3 truncate">
              {actionSheetMsg.text || 'Attachment'}
            </p>

            <button onClick={() => { setIsSelectMode(true); toggleSelectMessage(actionSheetMsg.id); setActionSheetMsg(null); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 text-sm font-semibold text-gray-800">
              <Check size={18} className="text-gray-500" /> Select message
            </button>

            <button onClick={() => handleReply(actionSheetMsg)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 text-sm font-semibold text-gray-800">
              <MessageSquare size={18} className="text-blue-500" /> Reply
            </button>

            {actionSheetMsg.senderId === user.id && !actionSheetMsg.isDeleted && (
              <button onClick={() => { handleStartEdit(actionSheetMsg); setActionSheetMsg(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 text-sm font-semibold text-gray-800">
                <Edit size={18} className="text-amber-500" /> Edit
              </button>
            )}

            {actionSheetMsg.text && (
              <button onClick={() => { navigator.clipboard?.writeText(actionSheetMsg.text); setActionSheetMsg(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 text-sm font-semibold text-gray-800">
                <Check size={18} className="text-gray-400" /> Copy text
              </button>
            )}

            {actionSheetMsg.senderId === user.id && !actionSheetMsg.isDeleted && (
              <button onClick={() => { handleDeleteMessage(actionSheetMsg.id); setActionSheetMsg(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-rose-50 text-sm font-semibold text-rose-600">
                <Trash2 size={18} /> Delete for everyone
              </button>
            )}

            <button onClick={() => { handleDeleteForMe(actionSheetMsg); setActionSheetMsg(null); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 text-sm font-semibold text-gray-500">
              <Trash2 size={18} /> Delete for me
            </button>
          </div>
        </div>
      )}

      {showGroupSettings && selectedChat && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-xs"
          onClick={() => setShowGroupSettings(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-5 pb-8 space-y-5 animate-in slide-in-from-bottom-4 duration-200 max-h-[80vh] overflow-y-auto custom-scrollbar flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto shrink-0" />
            
            {/* Header info */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                  ⚙️ Group Settings
                </h3>
                <h2 className="text-sm font-extrabold text-[#1c1e21] uppercase tracking-wider mt-1.5">
                  {selectedChat.name || selectedChat.teacherName || 'Staff Group'}
                </h2>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mt-1">
                  👥 {selectedChat.memberIds?.length || 0} Members
                </span>
              </div>
              <button
                onClick={() => setShowGroupSettings(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Toggle Switch row */}
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
              <div>
                <p className="text-xs font-bold text-gray-800">Allow members to send messages</p>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">
                  {selectedChat.isOpen !== false 
                    ? "Currently OPEN: Anyone in the group can post." 
                    : "Currently LOCKED: Only you as administrator can post."}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await api.patch(`/v1/chats/group/${user.schoolId}/toggle-open`);
                    setSelectedChat((prev: any) => ({ ...prev, isOpen: res.data.isOpen }));
                    setMyChats((prev: any) => {
                      if (prev.group && prev.group.id === selectedChat.id) {
                        return {
                          ...prev,
                          group: { ...prev.group, isOpen: res.data.isOpen }
                        };
                      }
                      return prev;
                    });
                  } catch (err) {
                    console.error('Failed to toggle open:', err);
                  }
                }}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 shrink-0 select-none ${
                  selectedChat.isOpen !== false ? 'bg-emerald-500 justify-end' : 'bg-gray-300 justify-start'
                }`}
                aria-label="Toggle group public messaging permissions"
              >
                <span className="bg-white w-5 h-5 rounded-full shadow-md transform duration-200 ease-in-out" />
              </button>
            </div>

            {/* Members Section */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Class Members List
              </h4>
              <div className="divide-y divide-gray-100 overflow-y-auto max-h-[250px] custom-scrollbar pr-1">
                {selectedChat.memberIds && selectedChat.memberIds.length > 0 ? (
                  selectedChat.memberIds.map((memberId: string) => {
                    const memberInfo = myChats.dms.find((m: any) => (m.teacherId || m.id) === memberId);
                    const isMe = memberId === user.id;
                    const isAdmin = memberId === selectedChat.adminId;
                    const displayName = isMe 
                      ? `${user.name} (You)` 
                      : (memberInfo ? (memberInfo.teacherName || memberInfo.name) : `Staff ${memberId.slice(0, 6)}`);

                    return (
                      <div key={memberId} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                            isAdmin ? 'bg-indigo-50 border border-indigo-110 text-indigo-600' : 'bg-blue-50 border border-blue-105 text-blue-600'
                          }`}>
                            {displayName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{displayName}</p>
                            <span className="text-[8px] font-mono text-gray-400 block uppercase tracking-wider">
                              ID: {memberId.slice(0, 8)} {isAdmin && '• ADMIN 👑'}
                            </span>
                          </div>
                        </div>
                        {!isAdmin && (
                          <button
                            onClick={async () => {
                              try {
                                await api.patch(`/v1/chats/group/${user.schoolId}/remove-member`, { teacherId: memberId });
                                setSelectedChat((prev: any) => {
                                  const updatedIds = prev.memberIds?.filter((id: string) => id !== memberId) || [];
                                  return {
                                    ...prev,
                                    memberIds: updatedIds,
                                    memberCount: Math.max(0, (prev.memberCount || 1) - 1)
                                  };
                                });
                                fetchMyChats();
                              } catch (err) {
                                console.error('Failed to remove member:', err);
                              }
                            }}
                            className="px-2.5 py-1 text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="py-4 text-center text-xs text-gray-400 font-bold uppercase tracking-wider">
                    No members in this group
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowGroupSettings(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wider shadow-md hover:shadow-lg transition-all text-center uppercase shrink-0"
            >
              Save & Exit Settings
            </button>
          </div>
        </div>
      )}

      {showMembersModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-gray-50 border-b border-gray-105 flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                👥 Manage Class Members
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 max-h-[300px] overflow-y-auto divide-y divide-gray-100 custom-scrollbar">
              {myChats.dms.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-450 font-bold uppercase tracking-wider">No active users list available</p>
              ) : (
                myChats.dms.map((teacher: any) => {
                  const isMember = selectedChat.memberIds?.includes(teacher.teacherId || teacher.id || '');
                  return (
                    <div key={teacher.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-blue-50 border border-blue-105 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {(teacher.teacherName || teacher.name || 'T').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{teacher.teacherName || teacher.name}</p>
                          <p className="text-[9px] text-gray-455 font-mono mt-0.5 uppercase tracking-wider">ID: {(teacher.teacherId || teacher.id || '').slice(0, 8)}</p>
                        </div>
                      </div>
                      {isMember ? (
                        <button
                          onClick={async () => {
                            try {
                              const tId = teacher.teacherId || teacher.id;
                              await api.patch(`/v1/chats/group/${user.schoolId}/remove-member`, { teacherId: tId });
                              setSelectedChat((prev: any) => {
                                const newIds = prev.memberIds?.filter((id: string) => id !== tId) || [];
                                return {
                                  ...prev,
                                  memberIds: newIds,
                                  memberCount: Math.max(0, (prev.memberCount || 1) - 1)
                                };
                              });
                              fetchMyChats();
                            } catch (err) {
                              console.error('Failed to remove member:', err);
                            }
                          }}
                          className="px-2.5 py-1 text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-100 transition-colors uppercase tracking-widest shrink-0"
                        >
                          Remove
                        </button>
                      ) : (
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest shrink-0 mr-1">Not in group</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowMembersModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #dbdedf;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd0d1;
        }
      `}</style>
    </div>
  );
}
