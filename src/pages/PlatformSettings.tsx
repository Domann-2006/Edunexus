import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Shield, 
  Cloud, 
  Save, 
  CheckCircle2, 
  Loader2, 
  Globe, 
  Mail, 
  Bell,
  Settings2,
  AlertTriangle,
  X,
  CreditCard,
  Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { platformSettingsService } from '../services/api';

export default function PlatformSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [settings, setSettings] = useState({
    platformName: 'EduNexus',
    platformLogo: '',
    maintenanceMode: false,
    registrationEnabled: true,
    supportEmail: 'support@edunexus.com',
    allowSchoolTrial: true,
    enforce2FA: false,
    autoSuspendDormant: true,
    notificationPreferences: {
      email: true,
      push: true,
      system: true
    }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await platformSettingsService.get();
      if (res.data) {
        setSettings({ ...settings, ...res.data });
      }
    } catch (err: any) {
      console.error('Fetch settings failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await platformSettingsService.update(settings);
      setToast({ message: 'Platform settings updated successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: 'Failed to update settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleMaintenance = () => {
    setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Loading System Config...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">System Configuration</h1>
          <p className="text-gray-500 font-medium mt-1 italic tracking-tight">Modify global platform parameters and enterprise rules.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 px-10 py-5 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          <span>Engage Changes</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
        <div className="lg:col-span-2 space-y-8">
          {/* Brand & Identity */}
          <section className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-10 border-b border-gray-50 flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center">
                <Monitor size={26} />
              </div>
              <div>
                <h3 className="font-black text-2xl text-gray-900 tracking-tighter">Brand & Identity</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Platform Presence</p>
              </div>
            </div>
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Platform Identity</label>
                  <div className="relative group">
                    <Globe className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={settings.platformName}
                      onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                      className="w-full pl-14 pr-6 py-5 bg-gray-50/50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/10 transition-all font-bold text-gray-900" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Support Contact</label>
                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      type="email" 
                      value={settings.supportEmail}
                      onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                      className="w-full pl-14 pr-6 py-5 bg-gray-50/50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/10 transition-all font-bold text-gray-900" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Security & Access */}
          <section className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-10 border-b border-gray-50 flex items-center gap-5">
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center">
                <Shield size={26} />
              </div>
              <div>
                <h3 className="font-black text-2xl text-gray-900 tracking-tighter">Security & Governance</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Safety Protocols</p>
              </div>
            </div>
            <div className="p-10 space-y-4">
              {[
                { 
                  id: 'maintenanceMode', 
                  label: 'Global Maintenance Mode', 
                  desc: 'Disable all user access for platform updates.',
                  status: settings.maintenanceMode,
                  danger: true
                },
                { 
                  id: 'registrationEnabled', 
                  label: 'New School Registrations', 
                  desc: 'Allow new schools to register for trials.',
                  status: settings.registrationEnabled 
                },
                { 
                  id: 'enforce2FA', 
                  label: 'Enforce MFA / 2FA', 
                  desc: 'Force all school administrators to use 2FA.',
                  status: settings.enforce2FA 
                },
                { 
                  id: 'autoSuspendDormant', 
                  label: 'Auto-Suspend Dormant Schools', 
                  desc: 'Deactivate schools inactive for 90+ days.',
                  status: settings.autoSuspendDormant 
                }
              ].map((toggle) => (
                <div key={toggle.id} className="flex items-center justify-between p-6 bg-gray-50/30 rounded-3xl border border-gray-50 group hover:border-gray-200 transition-all">
                  <div className="space-y-1">
                    <span className="block text-sm font-black text-gray-800 tracking-tight">{toggle.label}</span>
                    <span className="block text-[10px] font-medium text-gray-400 tracking-tight leading-relaxed">{toggle.desc}</span>
                  </div>
                  <div 
                    onClick={() => setSettings({ ...settings, [toggle.id]: !toggle.status })}
                    className={`w-14 h-8 rounded-full p-1.5 transition-all duration-500 cursor-pointer relative ${
                      toggle.status 
                        ? (toggle.danger ? 'bg-rose-600' : 'bg-gray-900') 
                        : 'bg-gray-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-500 flex items-center justify-center ${
                      toggle.status ? 'translate-x-6' : 'translate-x-0'
                    }`}>
                       {toggle.status && <div className={`w-1.5 h-1.5 rounded-full ${toggle.danger ? 'bg-rose-600' : 'bg-gray-900'}`} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <section className="bg-gray-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
             <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl">
                    <Cloud className="text-blue-400" size={24} />
                  </div>
                  <h3 className="font-black text-xl tracking-tighter">Cluster Health</h3>
                </div>
                <div className="space-y-6">
                  {[
                    { name: 'Identity Engine', status: 'Optimal' },
                    { name: 'Compute Grid', status: 'Optimal' },
                    { name: 'Storage Matrix', status: 'Optimal' },
                    { name: 'Network Ingress', status: 'Nominal' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-blue-100/50 uppercase tracking-[0.2em]">{s.name}</span>
                      <div className="flex items-center gap-2 font-black text-[9px] uppercase tracking-widest border border-white/10 px-3 py-1 rounded-full bg-white/5">
                         <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                         <span>{s.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <Settings2 size={120} className="rotate-45" />
             </div>
          </section>

          <section className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-sm space-y-8">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-4">Revenue Engine</h4>
             <div className="space-y-10">
                <div className="flex items-center gap-5">
                   <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <CreditCard size={20} />
                   </div>
                   <div>
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subscription API</div>
                      <div className="text-sm font-black text-gray-900 tracking-tight">Stripe Gateway: Active</div>
                   </div>
                </div>
                <div className="flex items-center gap-5">
                   <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Building size={20} />
                   </div>
                   <div>
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Multi-Tenancy</div>
                      <div className="text-sm font-black text-gray-900 tracking-tight">Active Nodes: 124</div>
                   </div>
                </div>
             </div>
          </section>
        </div>
      </div>

      {/* Notifications Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{toast.message}</span>
              <button 
                onClick={() => setToast(null)}
                className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
