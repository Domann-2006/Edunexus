import React from 'react';
import { Headphones, Search, MessageCircle, Clock, ShieldAlert } from 'lucide-react';

export default function SupportTickets() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Support Center</h1>
          <p className="text-gray-500 font-medium mt-1">Manage technical issues, school complaints and platform feedback.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Ticket Stats</div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Open Tickets</span>
              <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-black">12</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Awaiting Response</span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-black">5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Resolved Today</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black">24</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="p-4 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <Search className="text-gray-400 ml-2" size={18} />
            <input 
              type="text" 
              placeholder="Filter by ticket ID, school or priority..." 
              className="flex-1 bg-transparent border-none outline-none font-medium text-sm"
            />
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            {[
              { id: 'TIC-1024', school: 'West View Academy', issue: 'Batch result upload failing', priority: 'High', time: '10m ago' },
              { id: 'TIC-1025', school: 'Sunshine Secondary', issue: 'New teacher invitation link expired', priority: 'Medium', time: '1h ago' },
            ].map((ticket, i) => (
              <div key={i} className="p-6 border-b border-gray-50 hover:bg-gray-50/50 transition-all cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-blue-600 tracking-tighter">#{ticket.id}</span>
                    <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{ticket.school}</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${ticket.priority === 'High' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                      {ticket.priority}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                      <Clock size={10} />
                      {ticket.time}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 font-medium line-clamp-1">{ticket.issue}</p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white" />
                    <div className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white" />
                  </div>
                  <div className="text-[10px] font-bold text-gray-400">Assigned to: Support Team Alpha</div>
                  <MessageCircle size={14} className="ml-auto text-gray-300 group-hover:text-blue-600 transform group-hover:scale-110 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
