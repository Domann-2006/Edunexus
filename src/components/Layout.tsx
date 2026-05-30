import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Menu, X, BookOpen, Bell } from 'lucide-react';
import OnboardingTour from './OnboardingTour';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
      console.error('Failed to stream unread notifications count:', error);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <OnboardingTour user={user} />
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {user?.schoolLogo ? (
            <img src={user.schoolLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white transform rotate-3">
              <BookOpen size={16} />
            </div>
          )}
          <span className="font-black text-xl tracking-tighter text-gray-900 italic">
            {user?.schoolName || 'EduNexus'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/notifications')}
            className="p-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-all relative cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={24} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-all"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="flex-1 lg:ml-64 p-3 md:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
