import React from 'react';
import { UserPlus, Search, MoreVertical, Shield } from 'lucide-react';

export default function SchoolAdmins() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">School Admins</h1>
          <p className="text-gray-500 font-medium mt-1">Manage school owners and administrators across the platform.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-blue-100 transition-all">
          <UserPlus size={18} />
          <span>Add New Admin</span>
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search admins by name or school..." 
                className="w-full pl-12 pr-6 py-3 bg-gray-50 rounded-xl border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1 bg-gray-50 rounded-lg">Active Admins: 42</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Details</th>
                  <th className="text-left p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">School</th>
                  <th className="text-left p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="text-left p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Activity</th>
                  <th className="p-6 text-right"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">JD</div>
                      <div>
                        <div className="font-bold text-gray-900">John Doe</div>
                        <div className="text-xs text-gray-500 font-medium">john@highland.edu</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6 font-bold text-gray-700 text-sm">Highland International Academy</td>
                  <td className="p-6">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Active</span>
                  </td>
                  <td className="p-6 text-sm text-gray-500 font-medium">2 hours ago</td>
                  <td className="p-6 text-right">
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
