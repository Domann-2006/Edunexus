import React from 'react';
import { Megaphone, Plus, Bell, Send, Trash2 } from 'lucide-react';

export default function Announcements() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Platform Announcements</h1>
          <p className="text-gray-500 font-medium mt-1">Send broadcast messages and maintenance updates to all schools.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all transform hover:scale-105 active:scale-95">
          <Plus size={18} />
          <span>New Broadcast</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {[
            { title: 'Scheduled Maintenance', date: 'April 20, 2024', target: 'All Schools', status: 'Scheduled' },
            { title: 'New Feature: AI Attendance', date: 'April 15, 2024', target: 'Premium Schools', status: 'Sent' },
          ].map((msg, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm group">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{msg.title}</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">{msg.date} • Target: {msg.target}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${msg.status === 'Sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {msg.status}
                </div>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed font-medium">
                We will be performing scheduled maintenance on the core platform infrastructure this weekend to improve performance and stability...
              </p>
              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-50">
                <button className="text-blue-600 font-bold text-xs flex items-center gap-2">
                  <Send size={14} />
                  <span>Resend</span>
                </button>
                <button className="text-red-500 font-bold text-xs flex items-center gap-2 ml-auto">
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-black text-xl tracking-tight mb-2">Broadcast Tips</h3>
              <p className="text-gray-400 text-xs font-medium leading-relaxed">
                Use broadcast messages to notify school admins about critical platform updates, downtime, or new features.
              </p>
              <div className="space-y-4 mt-8">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <Bell size={18} className="text-amber-400" />
                  </div>
                  <p className="text-xs text-gray-300">Urgent maintenance alerts should be sent at least 48 hours in advance.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
