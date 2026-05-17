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
  User as UserIcon,
  Settings,
  CreditCard,
  PieChart,
  Megaphone,
  LifeBuoy,
  Monitor,
  Activity
} from 'lucide-react';
import ProfileImage from './ProfileImage';

interface SidebarProps {
  user: any;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ user, onLogout, isOpen, onClose }: SidebarProps) {
  const role = user?.role;

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
      { name: 'Support Tickets', path: '/super-admin/support', icon: LifeBuoy },
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
    { section: 'Settings', items: [
      ...(role === 'SCHOOL_ADMIN' ? [
        { name: 'Teacher Activity', path: '/activity-logs?filter=teacher', icon: Activity },
        { name: 'Support Center', path: '/super-admin/support', icon: LifeBuoy },
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
      <div className="p-8 flex items-center justify-between">
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
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-xs"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
    </>
  );
}
