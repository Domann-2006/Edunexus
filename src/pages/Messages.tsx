import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, limit, updateDoc, increment } from 'firebase/firestore';
import { Send, Search, CheckCheck, Loader2, ChevronLeft, MoreVertical, Paperclip, Smile, X, Image as ImageIcon, FileText, Trash2, Edit, AlertCircle, Check, Laptop, Sparkles, MessageSquare } from 'lucide-react';
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
  
  // Firebase Auth sync checkpoint
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseTimeout, setFirebaseTimeout] = useState(false);
  const [sendError, setSendError] = useState('');
  
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
    if (isSuper) {
      fetchSchools();
    } else {
      // School Admin: Fixed chat with Super Admin Support
      setSelectedChat({
        id: user.schoolId,
        name: 'Super Admin Support',
        isSupport: true
      });
      setShowSidebar(false);
    }
    
    // Set static online status indicator for Super Admin support
    setOnlineStatus(prev => ({ ...prev, 'SUPER': 'online' }));
  }, []);

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
            await signInWithCustomToken(auth, data.firebaseToken);
            if (isMounted) {
              setFirebaseReady(true);
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
  useEffect(() => {
    if (isSuper && location.state?.selectedChatId && schools.length > 0) {
      const targetSchool = schools.find(s => s.id === location.state.selectedChatId);
      setSelectedChat({
        id: location.state.selectedChatId,
        name: location.state.selectedSchoolName || targetSchool?.name || 'School Admin'
      });
      setShowSidebar(false);
    }
  }, [location.state, schools]);

  const fetchSchools = async () => {
    try {
      const res = await schoolService.list();
      setSchools(res.data);
      
      const statusSeed: Record<string, 'online' | 'offline'> = {};
      res.data.forEach((s: any) => {
        statusSeed[s.id] = Math.random() > 0.35 ? 'online' : 'offline';
      });
      setOnlineStatus(prev => ({ ...prev, ...statusSeed }));
    } catch (err) {
      console.error('Failed to pre-fetch schools for messaging:', err);
    }
  };

  // Real-time listener for discussions list (only runs when Firebase credentials match)
  useEffect(() => {
    if (!user || !firebaseReady) return;

    const q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = isSuper ? convos : convos.filter((c: any) => c.id === user.schoolId);
      setConversations(filtered);
      setLoading(false);
    }, (error) => {
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

  // SEND MESSAGE ROUTINE WITH OPTIMISTIC AND OFFLINE COEXISTENCE
  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSendError('');

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
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <div className="h-[calc(100vh-140px)] flex bg-gray-100 rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in duration-500">
      
      {/* Sidebar - Dynamically responsive */}
      {(isSuper && (showSidebar || window.innerWidth >= 1024)) ? (
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
             ) : filteredSchoolsList.length === 0 ? (
                <div className="py-20 text-center px-4">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">No conversations indexed</p>
                </div>
             ) : (
                filteredSchoolsList.map(school => {
                  const convo = conversations.find(c => c.id === school.id);
                  const isSelected = selectedChat?.id === school.id;
                  const status = getChatOnlineStatus(school.id);
                  return (
                    <button 
                      key={school.id}
                      onClick={() => {
                         setSelectedChat(school);
                         setShowSidebar(false);
                      }}
                      className={`w-full p-4 flex items-center gap-4 transition-all text-left ${
                        isSelected ? 'bg-blue-50/50 hover:bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 bg-gradient-to-tr from-blue-50 to-indigo-100 text-blue-600 border border-indigo-200/50 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm">
                          {school.name.charAt(0)}
                        </div>
                        {status === 'online' && (
                          <span className="absolute -bottom-1 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-gray-900 text-xs truncate uppercase tracking-wider">{school.name}</span>
                          {convo?.updatedAt && (
                            <span className="text-[8px] text-gray-400 font-semibold whitespace-nowrap uppercase">
                              {convo.updatedAt.toDate ? convo.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                           <div className="text-[11px] text-gray-400 truncate pr-4 font-normal">
                             {convo ? convo.lastMessage : 'No messages yet'}
                           </div>
                           {convo?.unreadCount > 0 && !isSelected && (
                             <div className="bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg shrink-0">
                               {convo.unreadCount}
                             </div>
                           )}
                        </div>
                      </div>
                    </button>
                  )
                })
             )}
          </div>
        </div>
      ) : null}

      {/* Main Discussion Console */}
      <div className={`flex-1 flex flex-col relative bg-[#efeae2] ${showSidebar && isSuper ? 'hidden lg:flex' : 'flex'}`}>
        
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
                  {isSuper && (
                    <button onClick={() => setShowSidebar(true)} className="lg:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center font-bold shadow text-xs">
                      {selectedChat.name?.charAt(0)}
                    </div>
                    {getChatOnlineStatus(selectedChat.id) === 'online' && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#1c1e21] text-xs leading-tight uppercase tracking-wider">{selectedChat.name}</h4>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider block mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {getChatOnlineStatus(selectedChat.id) === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
               </div>
               
               <div>
                  <span className="text-[9px] font-bold px-2.5 py-1 bg-gray-100 rounded-full text-gray-500 uppercase tracking-wider font-mono border border-gray-200/50">
                    ID: {selectedChat.id.slice(0, 8)}
                  </span>
               </div>
            </div>

            {/* Bubble conversation display window */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 relative z-10 custom-scrollbar">
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

                      <div className={`flex items-start gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {!isMine && (
                          <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-[10px] shadow-sm uppercase shrink-0">
                            {msg.senderName?.charAt(0) || 'A'}
                          </div>
                        )}

                        <div className="relative group max-w-[75%] md:max-w-[65%]">
                          {/* Chat Options Context Menu */}
                          {!isFailed && (
                            <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMessageMenuId(activeMessageMenuId === msg.id ? null : msg.id);
                                }}
                                className="p-1 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 shadow-sm transition-all"
                                title="Message controls"
                              >
                                <MoreVertical size={11} />
                              </button>
                              
                              {isMenuOpen && (
                                <div className="absolute top-5 right-0 w-36 bg-white rounded-xl shadow-lg ring-1 ring-black/5 p-1 text-left z-50 animate-in fade-in duration-100">
                                  {isMine && !msg.isDeleted && (
                                    <button 
                                      onClick={() => handleStartEdit(msg)}
                                      className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                                    >
                                      <Edit size={11} className="text-amber-500" />
                                      Edit
                                    </button>
                                  )}
                                  {!msg.isDeleted && isMine && (
                                    <button 
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2"
                                    >
                                      <Trash2 size={11} />
                                      Delete everyone
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleDeleteForMe(msg)}
                                    className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                                  >
                                    <Trash2 size={11} />
                                    Delete for me
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Chat bubble body card with authentic WhatsApp shades */}
                          <div className={`px-3 py-2 rounded-2xl shadow-sm text-xs relative ${
                            isMine 
                              ? isFailed ? 'bg-rose-100 border border-rose-200 text-rose-950' : 'bg-[#d9fdd3] border border-[#c4e9be] text-gray-900 rounded-tr-none' 
                              : 'bg-white border border-gray-200/50 text-gray-900 rounded-tl-none'
                          }`}>
                            {!isMine && (
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
                                      <div className="relative group/att cursor-pointer">
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
                                      <a 
                                        href={msg.attachment.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors"
                                      >
                                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                          <FileText size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[10px] font-semibold text-gray-800 truncate">{msg.attachment.name}</p>
                                          <p className="text-[9px] text-gray-400 font-bold">{msg.attachment.size || 'Attachment'}</p>
                                        </div>
                                      </a>
                                    )}
                                  </div>
                                )}

                                <p className={`leading-relaxed whitespace-pre-wrap pr-4 text-xs font-semibold ${msg.isDeleted ? 'italic text-gray-400' : 'text-gray-950'}`}>
                                  {msg.text}
                                </p>
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
              <div id="reconnecting-warning-banner" className="px-5 py-3 bg-amber-50 border-t border-amber-200/60 flex items-center gap-2.5 relative z-20 text-amber-800 animate-pulse">
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
            )}

            {/* Sticky Input Footer */}
            <div className="p-3 bg-white border-t border-gray-200/50 relative z-20">
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
                       className={`p-2 hover:bg-gray-100 rounded-xl hover:text-gray-900 transition-colors ${showEmojiPicker ? 'text-blue-600 bg-blue-50' : ''}`}
                       title="Insert emoji"
                     >
                       <Smile size={19} />
                     </button>

                     <button
                       type="button" 
                       onClick={() => imageInputRef.current?.click()}
                       className="p-2 hover:bg-gray-100 rounded-xl hover:text-gray-900 transition-colors"
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
                       className="p-2 hover:bg-gray-100 rounded-xl hover:text-gray-900 transition-colors"
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
            </div>
          </>
        )}
      </div>

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
