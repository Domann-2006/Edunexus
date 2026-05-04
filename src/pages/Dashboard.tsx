import React, { useState, useEffect } from 'react';
import { dashboardService } from '../services/api';
import { Users, UserPlus, BookOpen, School, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
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

  useEffect(() => {
    dashboardService.getStats()
      .then(res => setStats(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Students', value: stats?.students || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Teachers', value: stats?.teachers || 0, icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Classes', value: stats?.classes || 0, icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Subjects', value: stats?.subjects || 0, icon: School, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (user.role === 'SUPER_ADMIN') {
    statCards.push({ label: 'Total Schools', value: stats?.schools || 0, icon: School, color: 'text-indigo-600', bg: 'bg-indigo-50' });
  }

  const chartData = [
    { name: 'Mon', value: 400 },
    { name: 'Tue', value: 300 },
    { name: 'Wed', value: 600 },
    { name: 'Thu', value: 800 },
    { name: 'Fri', value: 500 },
    { name: 'Sat', value: 200 },
    { name: 'Sun', value: 100 },
  ];

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Overview</h1>
          <p className="text-gray-500 mt-1">Welcome back, {user.name}. Here's what's happening.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-600 shadow-sm">
          <Calendar size={16} />
          <span>May 2026</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon size={24} />
              </div>
              <div className="flex items-center text-emerald-500 text-xs font-bold gap-1 bg-emerald-50 px-2 py-1 rounded-full">
                <TrendingUp size={12} />
                <span>+12%</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-gray-400 uppercase tracking-wider">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm"
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-gray-900">Attendance Activity</h3>
            <select className="text-xs font-semibold bg-gray-50 border-0 rounded-lg px-3 py-2 outline-none">
              <option>Last 7 Days</option>
              <option>Last Month</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    fontSize: '12px'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm"
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-gray-900">Performance Index</h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Section A</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    fontSize: '12px'
                  }} 
                />
                <Bar 
                  dataKey="value" 
                  fill="#2563eb" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
