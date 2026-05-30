import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  BookOpen, 
  School, 
  LogOut,
  LayoutDashboard,
  Book,
  FileSpreadsheet,
  X,
  CheckSquare,
  ShieldCheck,
  User as UserIcon,
  Settings,
  CreditCard,
  PieChart,
  Megaphone,
  LifeBuoy,
  Monitor,
  Activity,
  WifiOff,
  CloudUpload,
  CloudLightning,
  Bell
} from 'lucide-react';
import ProfileImage from './ProfileImage';
import { cacheEvents, offlineQueue } from '../services/api';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface SidebarProps {
  user: any;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ user, onLogout, isOpen, onClose }: SidebarProps) {
  const role = user?.role;
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.id),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (error) => {
      console.error('Failed to stream unread notifications count in Sidebar:', error);
    });
    return () => unsubscribe();
  }, [user]);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'offline_queued' | 'offline'>(() => {
    return navigator.onLine ? 'idle' : 'offline';
  });
  const [queueCount, setQueueCount] = useState(offlineQueue.length);

  useEffect(() => {
    const handleSyncStatus = (data: any) => {
      if (data && data.status) {
        setSyncStatus(data.status);
        setQueueCount(data.count || 0);
      }
    };

    const unsubscribe = cacheEvents.subscribe((key, payload) => {
      if (key === 'sync_status') {
        handleSyncStatus(payload);
      } else if (key === 'sync_completed') {
        setSyncStatus('idle');
        setQueueCount(0);
      }
    });

    const handleOnline = () => {
      setSyncStatus(offlineQueue.length > 0 ? 'syncing' : 'idle');
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Platform Management for SUPER_ADMIN
  const superAdminItems = [
    { section: 'Platform', items: [
      { name: 'Overview', path: '/', icon: LayoutDashboard },
      { name: 'Schools', path: '/schools', icon: School },
      { name: 'School Admins', path: '/super-admin/admins', icon: user?.role === 'SUPER_ADMIN' ? UserPlus : undefined },
      { name: 'Subscriptions', path: '/super-admin/subscriptions', icon: CreditCard },
    ]},
    { section: 'Insights', items: [
      { name: 'Reports', path: '/super-admin/reports', icon: PieChart },
      { name: 'Audit Logs', path: '/activity-logs', icon: ShieldCheck },
    ]},
    { section: 'Operations', items: [
      { name: 'Announcements', path: '/super-admin/announcements', icon: Megaphone },
      { name: 'Support Desk', path: '/messages', icon: LifeBuoy },
    ]},
    { section: 'System', items: [
      { name: 'Platform Settings', path: '/super-admin/settings', icon: Monitor },
      { name: 'My Profile', path: '/profile', icon: UserIcon },
    ]}
  ];

  // School Operations for SCHOOL_ADMIN and TEACHER
  const schoolItems = [
    { section: 'Management', items: [
      { name: 'Overview', path: '/', icon: LayoutDashboard },
      { name: 'Students', path: '/students', icon: Users },
      ...(role === 'SCHOOL_ADMIN' ? [{ name: 'Teachers', path: '/teachers', icon: UserPlus }] : []),
      { name: 'Classes', path: '/classes', icon: BookOpen },
      { name: 'Subjects', path: '/subjects', icon: Book },
    ]},
    { section: 'Academic', items: [
      { name: role === 'SCHOOL_ADMIN' ? 'Attendance Monitor' : 'Attendance', path: '/attendance', icon: CheckSquare },
      { name: role === 'SCHOOL_ADMIN' ? 'Result Monitoring' : 'Results', path: '/results', icon: FileSpreadsheet },
    ]},
    { section: 'Support Uplink', items: [
       ...(role === 'SCHOOL_ADMIN' ? [{ name: 'Support Chat', path: '/messages', icon: LifeBuoy }] : []),
       ...(role === 'SCHOOL_ADMIN' ? [{ name: 'My Subscription', path: '/subscription-details', icon: CreditCard }] : []),
    ]},
    { section: 'Settings', items: [
      ...(role === 'SCHOOL_ADMIN' ? [
        { name: 'Teacher Activity', path: '/activity-logs?filter=teacher', icon: Activity },
        { name: 'School Settings', path: '/settings/school', icon: Settings },
        { name: 'System Logs', path: '/activity-logs', icon: ShieldCheck }
      ] : []),
      { name: 'My Profile', path: '/profile', icon: UserIcon },
    ]}
  ];

  const sections = role === 'SUPER_ADMIN' ? superAdminItems : schoolItems;

  return (
    <>
      {/* Overlay - visible on mobile when sidebar is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        w-64 bg-white border-r border-gray-100 flex flex-col h-[100dvh] fixed left-0 top-0 z-40 transition-all duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="p-5 lg:p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.schoolLogo ? (
            <img src={user.schoolLogo} alt="Logo" className="w-10 h-10 rounded-xl object-contain shadow-sm" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100 transform rotate-3">
              <BookOpen size={20} />
            </div>
          )}
          <span className="font-black text-2xl tracking-tighter text-gray-900 italic transform transition-all group-hover:scale-105 origin-left">
            {user?.schoolName ? (
              <span className="truncate max-w-[120px] block">{user.schoolName}</span>
            ) : 'EduNexus'}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-xl"
        >
          <X size={20} />
        </button>
      </div>

      <nav id="sidebar-nav" className="flex-1 px-4 space-y-6 overflow-y-auto pb-8 scrollbar-hide">
        {sections.map((section) => (
          <div key={section.section} className="space-y-1">
            <div className="px-4 mb-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{section.section}</span>
            </div>
            {section.items.filter(item => item.icon).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 font-bold' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
                  }`
                }
              >
                <item.icon size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm tracking-tight">{item.name}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Connection & Sync Hub Indicator */}
      <div className="px-6 mb-3">
        {syncStatus === 'offline' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-2xl border border-amber-100/60 text-amber-700 text-xs font-semibold">
            <WifiOff size={14} className="shrink-0 text-amber-500 animate-pulse" />
            <span>Offline Mode</span>
          </div>
        )}
        {syncStatus === 'offline_queued' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-2xl border border-orange-100/60 text-orange-700 text-xs font-semibold">
            <CloudLightning size={14} className="shrink-0 text-orange-500 animate-bounce" />
            <span>{queueCount} change{queueCount > 1 ? 's' : ''} queued offline</span>
          </div>
        )}
        {syncStatus === 'syncing' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-2xl border border-blue-100/60 text-blue-700 text-xs font-bold">
            <CloudUpload size={14} className="shrink-0 text-blue-500 animate-bounce" />
            <span>Syncing changes ({queueCount})...</span>
          </div>
        )}
        {syncStatus === 'completed' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-2xl border border-green-100/60 text-green-700 text-xs font-bold animate-fade-in">
            <ShieldCheck size={14} className="shrink-0 text-green-500" />
            <span>Sync Completed!</span>
          </div>
        )}
        {syncStatus === 'idle' && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-gray-400 text-[10px] font-black uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping mr-1" />
            <span>Cloud Synced</span>
          </div>
        )}
      </div>

      <div id="profile-section" className="p-4 border-t border-gray-50">
        <div className="bg-gray-50/80 rounded-3xl p-4 mb-3 border border-gray-100 flex items-center gap-3">
          <ProfileImage url={user?.avatarUrl || (user?.role === 'SCHOOL_ADMIN' ? user?.schoolLogo : undefined)} size="sm" />
          <div className="min-w-0">
            <div className="font-bold text-xs text-gray-900 truncate tracking-tight">{user?.name || 'User'}</div>
            <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-0.5 opacity-70">
              {user?.role?.replace('_', ' ') || 'GUEST'}
            </div>
          </div>
        </div>
        
        <button
          onClick={() => {
            navigate('/notifications');
            onClose();
          }}
          className="w-full flex items-center justify-between px-5 py-3.5 text-gray-700 hover:bg-gray-50 rounded-2xl transition-all font-bold text-xs mb-1 relative cursor-pointer font-sans"
        >
          <div className="flex items-center gap-3">
            <Bell size={16} />
            <span>Notifications</span>
          </div>
          {unreadCount > 0 && (
            <span className="w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-xs font-sans"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
    </>
  );
}
