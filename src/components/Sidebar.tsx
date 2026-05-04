import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  BarChart2, 
  Users, 
  UserPlus, 
  BookOpen, 
  School, 
  LogOut,
  LayoutDashboard
} from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  user: any;
  onLogout: () => void;
}

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Students', path: '/students', icon: Users },
    { name: 'Teachers', path: '/teachers', icon: UserPlus },
    { name: 'Classes', path: '/classes', icon: BookOpen },
  ];

  if (user.role === 'SUPER_ADMIN') {
    menuItems.push({ name: 'Schools', path: '/schools', icon: School });
  }

  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
          <BookOpen size={20} />
        </div>
        <span className="font-bold text-xl tracking-tight text-gray-900">EduNexus</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-50 text-blue-600 font-medium' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`
            }
          >
            <item.icon size={20} />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-50">
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="font-medium text-sm text-gray-900 truncate">{user.name}</div>
          <div className="text-xs text-gray-500 truncate lowercase">{user.role.replace('_', ' ')}</div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
