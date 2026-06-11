import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Bell, Users, Megaphone, FileSpreadsheet, CheckCheck, Loader2, Inbox } from 'lucide-react';
import { motion } from 'motion/react';
import api from '../services/api';

interface NotificationDoc {
  id: string;
  recipientId: string;
  recipientRole: string;
  schoolId: string;
  title: string;
  message: string;
  type: 'message' | 'student' | 'teacher' | 'announcement' | 'result';
  read: boolean;
  createdAt: string;
  metadata?: {
    classId?: string;
    sessionId?: string;
    subjectId?: string;
    term?: string;
  };
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

function getRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const getNotificationLink = (notification: NotificationDoc): string => {
  switch (notification.type) {
    case 'message': return '/messages';
    case 'student': return '/students';
    case 'teacher': return '/teachers';
    case 'announcement': return '/super-admin/announcements';
    case 'result': {
      const m = notification.metadata;
      if (m?.classId && m?.sessionId && m?.subjectId) {
        const params = new URLSearchParams({
          classId: m.classId,
          sessionId: m.sessionId,
          subjectId: m.subjectId,
          term: m.term || '1st',
        });
        return `/results?${params.toString()}`;
      }
      return '/results';
    }
    default: return '/notifications';
  }
};

export default function Notifications({ user }: { user: any }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const path = 'notifications';
    const q = query(
      collection(db, path),
      where('recipientId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: NotificationDoc[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as NotificationDoc);
        });
        setNotifications(list);
        setLoading(false);
      },
      (error) => {
        setErrorText(error.message);
        setLoading(false);
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (e) {
          // Keep failure reporting contained
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleMarkAsRead = async (id: string, currentlyRead: boolean, notification: NotificationDoc) => {
    try {
      if (!currentlyRead) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        await api.put(`/v1/notifications/${id}/read`);
      }
      navigate(getNotificationLink(notification));
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAllRead = async () => {
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount === 0) return;
    try {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      await api.put('/v1/notifications/mark-all-read');
    } catch (err: any) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <Bell className="w-5 h-5 text-blue-600" />;
      case 'student':
        return <Users className="w-5 h-5 text-emerald-600" />;
      case 'announcement':
        return <Megaphone className="w-5 h-5 text-amber-600" />;
      case 'result':
        return <FileSpreadsheet className="w-5 h-5 text-indigo-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getBadgeBg = (type: string) => {
    switch (type) {
      case 'message':
        return 'bg-blue-50';
      case 'student':
        return 'bg-emerald-50';
      case 'announcement':
        return 'bg-amber-50';
      case 'result':
        return 'bg-indigo-50';
      default:
        return 'bg-gray-50';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div id="notifications-page" className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Notifications</h1>
          <p className="text-gray-500 mt-1">Stay updated with important school and platform updates.</p>
        </div>
        
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Loading your updates...</p>
        </div>
      ) : errorText ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-center">
          Failed to load notifications: {errorText}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">All clear!</h3>
          <p className="text-gray-500 max-w-sm mt-2">You don't have any notifications at the moment. We'll let you know when something happens.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              onClick={() => handleMarkAsRead(notification.id, notification.read, notification)}
              className={`
                bg-white p-5 rounded-2xl shadow-sm border border-gray-100 
                flex items-start gap-4 transition-all hover:shadow-md cursor-pointer relative overflow-hidden
                ${!notification.read ? 'border-l-[6px] border-l-blue-600 pl-4' : 'pl-5'}
              `}
            >
              {/* Icon Container */}
              <div className={`p-3 rounded-2xl shrink-0 ${getBadgeBg(notification.type)}`}>
                {getNotificationIcon(notification.type)}
              </div>

              {/* Message Block */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h4 className={`text-base font-bold text-gray-900 leading-snug break-words ${!notification.read ? 'text-black' : 'text-gray-700'}`}>
                    {notification.title}
                  </h4>
                  {!notification.read && (
                    <span className="shrink-0 w-2.5 h-2.5 bg-blue-600 rounded-full mt-1.5" />
                  )}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mt-1 whitespace-pre-line break-words">
                  {notification.message}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2.5">
                  <span>{getRelativeTime(notification.createdAt)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
