import React from 'react';
import { Monitor, Bell, Shield, Cloud, Save, CheckCircle2 } from 'lucide-react';

export default function PlatformSettings() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Platform Settings</h1>
          <p className="text-gray-500 font-medium mt-1">Configure global platform configurations and feature toggles.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all active:scale-95">
          <Save size={18} />
          <span>Save Changes</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Monitor size={22} />
              </div>
              <h3 className="font-black text-xl text-gray-900 tracking-tight">Global Branding</h3>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Platform Name</label>
                  <input type="text" defaultValue="EduNexus" className="w-full px-5 py-3.5 bg-gray-50/50 rounded-2xl border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all font-bold text-gray-900" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 shadow-lg shadow-blue-100" />
                    <input type="text" defaultValue="#3b82f6" className="flex-1 px-5 py-3.5 bg-gray-50/50 rounded-2xl border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all font-bold text-gray-900" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Shield size={22} />
              </div>
              <h3 className="font-black text-xl text-gray-900 tracking-tight">Security & Governance</h3>
            </div>
            <div className="p-8 space-y-4">
              {[
                { label: 'Enforce 2FA for School Admins', status: true },
                { label: 'Global Maintenance Mode', status: false },
                { label: 'Auto-Suspend Dormant Schools (90 days)', status: true },
              ].map((toggle, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-50">
                  <span className="text-sm font-bold text-gray-700 tracking-tight">{toggle.label}</span>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${toggle.status ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${toggle.status ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-50 rounded-[2.5rem] p-8 border border-gray-100">
             <div className="flex items-center gap-3 mb-6">
               <Cloud className="text-blue-600" size={24} />
               <h3 className="font-black text-lg tracking-tight">System Status</h3>
             </div>
             <div className="space-y-4">
                {[
                  { name: 'Core API', status: 'Healthy' },
                  { name: 'Database', status: 'Healthy' },
                  { name: 'Auth Service', status: 'Healthy' },
                  { name: 'Image CDN', status: 'Degraded' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{s.name}</span>
                    <div className="flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest">
                       <CheckCircle2 size={12} className={s.status === 'Healthy' ? 'text-emerald-500' : 'text-amber-500'} />
                       <span className={s.status === 'Healthy' ? 'text-emerald-600' : 'text-amber-600'}>{s.status}</span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
