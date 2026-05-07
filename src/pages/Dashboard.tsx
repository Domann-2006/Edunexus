import React, { useState, useEffect } from 'react';
import { dashboardService, schoolService } from '../services/api';
import { 
  Users, 
  UserPlus, 
  BookOpen, 
  School,
  TrendingUp,
  ArrowRight,
  Book,
  Calendar,
  FileSpreadsheet,
  Zap,
  MoreVertical
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export default function Dashboard({ user }: { user: any }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      schoolService.list().then(res => setSchools(res.data));
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    dashboardService.getStats({ schoolId: selectedSchoolId })
      .then(res => setStats(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const statCards = [
    { name: 'Students', value: stats?.students || 0, icon: Users, color: 'blue', link: '/students' },
    { name: 'Teachers', value: stats?.teachers || 0, icon: UserPlus, color: 'indigo', link: '/teachers' },
    { name: 'Classes', value: stats?.classes || 0, icon: BookOpen, color: 'emerald', link: '/classes' },
    { name: 'Subjects', value: stats?.subjects || 0, icon: Book, color: 'amber', link: '/subjects' },
  ];

  if (user?.role === 'SUPER_ADMIN') {
    statCards.push({ name: 'Schools', value: stats?.schools || 0, icon: School, color: 'rose', link: '/schools' });
  }

  const chartData = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 },
  ];

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Overview</h1>
          <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Academic Year 2025/2026 • First Term</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          {user?.role === 'SUPER_ADMIN' && (
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="px-5 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <Calendar size={18} className="text-blue-600" />
            <span className="text-sm font-bold text-gray-700 tracking-tight">May 4, 2026</span>
          </div>
          {user?.role === 'SCHOOL_ADMIN' && (
            <button className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
              <Zap size={20} />
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-[2.5rem]" />
          ))
        ) : (
          statCards.map((card, i) => (
            <motion.div
              key={card.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <card.icon size={22} />
                </div>
                <div className="flex items-center text-emerald-500 text-[10px] font-black tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
                  <TrendingUp size={12} className="mr-1" />
                  <span>+12%</span>
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-4xl font-black text-gray-900 tracking-tight">{card.value}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">{card.name}</div>
              </div>
              <Link to={card.link} className="absolute inset-0 z-20"></Link>
            </motion.div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Active Enrollment</h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500 rounded-xl">Last 6 Months</button>
              <button className="p-2 text-gray-400"><MoreVertical size={18} /></button>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="relative z-10 flex flex-col h-full">
            <h2 className="text-2xl font-black tracking-tight leading-tight mb-4">Quick Actions</h2>
            <div className="space-y-3 mt-4">
              <Link to="/results" className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all group">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center">
                  <FileSpreadsheet size={18} />
                </div>
                <span className="text-sm font-bold">Record Results</span>
                <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
              </Link>
              <Link to="/students" className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all group">
                <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <span className="text-sm font-bold">Admit Student</span>
                <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
              </Link>
            </div>

            <div className="mt-auto pt-10">
              <div className="p-6 bg-blue-600 rounded-[2rem] relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-1">Status</div>
                  <div className="text-lg font-black tracking-tight mb-4">Premium Support</div>
                  <button className="w-full py-3 bg-white text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest group-hover:scale-105 transition-transform">Get Help</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
