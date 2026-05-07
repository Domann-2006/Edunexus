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
  FileSpreadsheet
} from 'lucide-react';
import ProfileImage from './ProfileImage';

interface SidebarProps {
  user: any;
  onLogout: () => void;
}

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const menuItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Students', path: '/students', icon: Users },
    { name: 'Teachers', path: '/teachers', icon: UserPlus },
    { name: 'Classes', path: '/classes', icon: BookOpen },
    { name: 'Subjects', path: '/subjects', icon: Book },
    { name: 'Results', path: '/results', icon: FileSpreadsheet },
  ];

  if (user?.role === 'SUPER_ADMIN') {
    menuItems.push({ name: 'Schools', path: '/schools', icon: School });
  }

  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100 transform rotate-3">
          <BookOpen size={20} />
        </div>
        <span className="font-black text-2xl tracking-tighter text-gray-900 italic">EduNexus</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        <div className="px-4 mb-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Management</span>
        </div>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
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

      <div className="p-6">
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
  );
}
