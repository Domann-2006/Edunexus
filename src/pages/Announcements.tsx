import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Bell, 
  Send, 
  Trash2, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  History,
  Target,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { announcementService } from '../services/api';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target: 'ALL_SCHOOLS',
    status: 'SENT'
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await announcementService.list();
      setAnnouncements(res.data);
    } catch (err: any) {
      console.error('Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await announcementService.create({
        ...formData,
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      });
      setIsModalOpen(false);
      setFormData({ title: '', content: '', target: 'ALL_SCHOOLS', status: 'SENT' });
      setToast({ message: 'Announcement broadcasted', type: 'success' });
      fetchAnnouncements();
    } catch (err: any) {
      setToast({ message: 'Broadcast failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await announcementService.delete(id);
      setToast({ message: 'Deleted successfully', type: 'success' });
      fetchAnnouncements();
    } catch (err: any) {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic">Platform Broadcasts</h1>
          <p className="text-gray-500 font-medium mt-1">Send maintenance updates and news to schools.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95"
        >
          <Plus size={18} />
          <span>New Broadcast</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white rounded-[3rem] border border-gray-100">
               <Loader2 className="animate-spin text-blue-600" size={32} />
               <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading history...</div>
            </div>
          ) : announcements.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center gap-6 bg-white rounded-[3rem] border border-gray-100 text-center px-12">
               <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center text-gray-200">
                 <Megaphone size={40} />
               </div>
               <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">No Broadcast History</h3>
                  <p className="text-sm text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
                    Broadcast messages have not been sent yet. Use the button above to communicate with school admins.
                  </p>
               </div>
            </div>
          ) : (
            announcements.map((msg) => (
              <motion.div 
                layout 
                key={msg.id} 
                className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm group hover:shadow-xl hover:shadow-gray-50 transition-all overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                  <Megaphone size={120} className="-rotate-12" />
                </div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-gray-200">
                      <Megaphone size={22} />
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-gray-900 tracking-tight pr-10">{msg.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none bg-blue-50 px-2 py-1 rounded-lg">
                           {msg.date}
                        </span>
                        <div className="w-1 h-1 bg-gray-200 rounded-full" />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <Target size={10} />
                          {msg.target?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${msg.status === 'SENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {msg.status}
                  </div>
                </div>

                <p className="text-gray-500 text-sm leading-relaxed font-medium mb-10 relative z-10 pr-4">
                  {msg.content}
                </p>

                <div className="flex items-center gap-6 relative z-10 border-t border-gray-50 pt-8">
                  <button className="flex items-center gap-2 group/btn">
                    <History size={16} className="text-blue-600 group-hover/btn:rotate-180 transition-transform duration-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Re-Transmissions</span>
                  </button>
                  <button 
                    onClick={() => handleDelete(msg.id)}
                    className="flex items-center gap-2 ml-auto text-rose-500 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Purge Record</span>
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="space-y-8">
          <section className="bg-gray-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl">
                   <Bell size={24} className="text-amber-400" />
                 </div>
                 <h3 className="font-black text-xl tracking-tight italic">Protocol</h3>
              </div>
              <ul className="space-y-6">
                 {[
                   'Maintenance alerts must be sent 48h prior.',
                   'Use professional tone for all transmissions.',
                   'Verify target segment before firing.',
                   'Security patches require "Urgent" status.'
                 ].map((tip, i) => (
                   <li key={i} className="flex gap-4">
                      <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      </div>
                      <p className="text-xs text-gray-400 font-medium tracking-tight leading-relaxed">{tip}</p>
                   </li>
                 ))}
              </ul>
            </div>
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
          </section>
        </div>
      </div>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center">
                      <Megaphone size={22} />
                    </div>
                    <div>
                       <h3 className="font-black text-xl text-gray-900 tracking-tight">New Platform Broadcast</h3>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Transmission</p>
                    </div>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-xl transition-all">
                   <X size={20} />
                 </button>
              </div>

              <form onSubmit={handleCreate} className="p-10 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Message Title</label>
                    <input 
                      required type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-900"
                      placeholder="e.g., Scheduled Core Maintenance"
                    />
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Segment Targeting</label>
                    <select 
                      value={formData.target}
                      onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-900 appearance-none"
                    >
                      <option value="ALL_SCHOOLS">All Platform Schools</option>
                      <option value="PREMIUM_ONLY">Premium Tier Only</option>
                      <option value="TRIAL_ONLY">Trial Users Only</option>
                    </select>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Payload / Content</label>
                    <textarea 
                      required rows={5}
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-900 resize-none h-40"
                      placeholder="Type your message to administrators..."
                    />
                 </div>

                 <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.3em] text-[10px] rounded-[2rem] shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                 >
                   {saving ? <Loader2 className="animate-spin" size={18} /> : (
                     <>
                        <span>Execute Broadcast</span>
                        <Send size={14} />
                     </>
                   )}
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
