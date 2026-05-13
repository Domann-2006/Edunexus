import React from 'react';
import { PieChart, TrendingUp, Filter, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PlatformReports() {
  const data = [
    { name: 'Jan', schools: 20, students: 4000 },
    { name: 'Feb', schools: 35, students: 6500 },
    { name: 'Mar', schools: 48, students: 8200 },
    { name: 'Apr', schools: 65, students: 12000 },
    { name: 'May', schools: 82, students: 15400 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight text-stroke-sm">Platform Reports</h1>
          <p className="text-gray-500 font-medium mt-1">Growth charts, usage statistics and performance summaries.</p>
        </div>
        <div className="flex gap-2">
          <button className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all">
            <Filter size={20} />
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:shadow-lg transition-all">
            <Download size={18} />
            <span>Export Global Stats</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-black text-xl text-gray-900 tracking-tight">School Growth</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Total Registered Schools</p>
            </div>
            <div className="bg-emerald-50 px-4 py-2 rounded-2xl flex items-center gap-2 text-emerald-600 font-black text-xs">
              <TrendingUp size={16} />
              <span>+34%</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="schools" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.05} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm text-stroke-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-black text-xl text-gray-900 tracking-tight">Enrollment Trends</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Total Platform Students</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="students" stroke="#8b5cf6" strokeWidth={3} fill="#8b5cf6" fillOpacity={0.05} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
