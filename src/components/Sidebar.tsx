import React from 'react';
import { NavLink } from 'react-router-dom';
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
  User as UserIcon
} from 'lucide-react';
import ProfileImage from './ProfileImage';

interface SidebarProps {
  user: any;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ user, onLogout, isOpen, onClose }: SidebarProps) {
  const menuItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'My Profile', path: '/profile', icon: UserIcon },
    { name: 'Students', path: '/students', icon: Users },
  ];

  if (user?.role !== 'TEACHER') {
    menuItems.push({ name: 'Teachers', path: '/teachers', icon: UserPlus });
  }

  menuItems.push(
    { name: 'Classes', path: '/classes', icon: BookOpen },
    { name: 'Subjects', path: '/subjects', icon: Book },
    { name: 'Attendance', path: '/attendance', icon: CheckSquare },
    { name: 'Results', path: '/results', icon: FileSpreadsheet },
  );

  if (user?.role === 'SUPER_ADMIN') {
    menuItems.push({ name: 'Schools', path: '/schools', icon: School });
  }

  if (user?.role === 'SUPER_ADMIN' || user?.role === 'SCHOOL_ADMIN') {
    menuItems.push({ name: 'Audit Logs', path: '/activity-logs', icon: ShieldCheck });
  }

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
        w-64 bg-white border-r border-gray-100 flex flex-col h-[100dvh] fixed left-0 top-0 z-40 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100 transform rotate-3">
            <BookOpen size={20} />
          </div>
          <span className="font-black text-2xl tracking-tighter text-gray-900 italic">EduNexus</span>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-xl"
        >
          <X size={20} />
        </button>
      </div>

      <nav id="sidebar-nav" className="flex-1 px-4 space-y-1 mt-4">
        <div className="px-4 mb-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Management</span>
        </div>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
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
      </nav>

      <div id="profile-section" className="p-6">
        <div className="bg-gray-50/80 rounded-3xl p-5 mb-4 border border-gray-100 flex items-center gap-3">
          <ProfileImage url={user?.avatarUrl} size="sm" />
          <div className="min-w-0">
            <div className="font-bold text-sm text-gray-900 truncate tracking-tight">{user?.name || 'User'}</div>
            {user?.schoolName && (
              <div className="text-[9px] font-bold text-gray-400 truncate tracking-tight">{user.schoolName}</div>
            )}
            <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1 opacity-70">
              {user?.role?.replace('_', ' ') || 'GUEST'}
            </div>
            {user?.role === 'SCHOOL_ADMIN' && (
              <button 
                onClick={() => {
                  localStorage.removeItem(`edunexus_onboarding_completed_${user?.id}`);
                  window.location.reload();
                }}
                className="text-[9px] font-bold text-gray-400 mt-2 hover:text-blue-600 transition-colors uppercase tracking-widest"
              >
                Restart Tour
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-sm"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
    </>
  );
}
