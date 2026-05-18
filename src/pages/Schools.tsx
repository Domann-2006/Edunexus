import React, { useState, useEffect } from 'react';
import { schoolService } from '../services/api';
import { Plus, Edit2, Trash2, X, Loader2, School as SchoolIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProfileImage from '../components/ProfileImage';

export default function Schools() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    plan: 'BASIC',
    logoUrl: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    subscriptionAmount: 0,
    subscriptionStartDate: new Date().toISOString().split('T')[0],
    subscriptionEndDate: '',
    subscriptionStatus: 'ACTIVE',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await schoolService.list();
      setSchools(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        subscriptionAmount: Number(formData.subscriptionAmount)
      };

      if (editingId) {
        await schoolService.update(editingId, data);
      } else {
        await schoolService.create({ 
          ...data, 
          userLimit: data.plan === 'BASIC' ? 50 : data.plan === 'PRO' ? 500 : 5000 
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this school? This will not delete its sub-data but will remove the school record.')) return;
    try {
      await schoolService.delete(id);
      fetchData();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const openModal = (school?: any) => {
    if (school) {
      setEditingId(school.id);
      setFormData({
        name: school.name,
        address: school.address || '',
        phone: school.phone || '',
        email: school.email || '',
        plan: school.plan || 'BASIC',
        logoUrl: school.logoUrl || '',
        adminName: school.adminName || '',
        adminEmail: school.adminEmail || '',
        adminPassword: '',
        subscriptionAmount: school.subscriptionAmount || 0,
        subscriptionStartDate: school.subscriptionStartDate || new Date().toISOString().split('T')[0],
        subscriptionEndDate: school.subscriptionEndDate || '',
        subscriptionStatus: school.subscriptionStatus || 'ACTIVE',
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        address: '', 
        phone: '', 
        email: '',
        plan: 'BASIC', 
        logoUrl: '', 
        adminName: '', 
        adminEmail: '', 
        adminPassword: '',
        subscriptionAmount: 0,
        subscriptionStartDate: new Date().toISOString().split('T')[0],
        subscriptionEndDate: '',
        subscriptionStatus: 'ACTIVE',
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic">Enterprise Schools</h1>
          <p className="text-gray-500 font-medium">Provision and manage multi-tenant educational institutions.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-3 px-8 py-5 bg-gray-900 text-white font-black uppercase tracking-[0.3em] text-[10px] rounded-[2rem] shadow-2xl hover:bg-black transition-all transform hover:-translate-y-1 active:scale-95"
        >
          <Plus size={18} />
          <span>Onboard School</span>
        </button>
      </header>

      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Identity & Admin</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Subscription</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Economics</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Loader2 className="animate-spin inline mr-3 text-blue-600" size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Matrix...</span>
                  </td>
                </tr>
              ) : schools.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="text-sm font-medium text-gray-400 italic">No schools registered in the ecosystem.</div>
                  </td>
                </tr>
              ) : (
                schools.map((school) => (
                  <tr key={school.id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-indigo-100">
                          {school.logoUrl ? (
                            <img src={school.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <SchoolIcon size={24} />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 tracking-tight">{school.name}</div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Admin: {school.adminName || 'Not Set'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          school.plan === 'PREMIUM' ? 'bg-amber-100 text-amber-600' : 
                          school.plan === 'PRO' ? 'bg-indigo-100 text-indigo-600' : 
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {school.plan}
                        </span>
                        <span className="text-[10px] font-medium text-gray-400">Exp: {school.subscriptionEndDate || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="text-sm font-black text-gray-900">${school.subscriptionAmount?.toLocaleString() || 0}</div>
                       <div className="text-[9px] font-bold text-gray-400 uppercase">Total Credited</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        school.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        <div className={`w-1 h-1 rounded-full ${school.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {school.subscriptionStatus}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => openModal(school)}
                          className="p-3 text-blue-600 bg-blue-50/50 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(school.id)}
                          className="p-3 text-red-600 bg-red-50/50 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-10">
                <header className="flex justify-between items-center mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tighter">{editingId ? 'Modify School' : 'Onboard New School'}</h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Tenant Configuration Matrix</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-gray-50 text-gray-300 hover:text-gray-600 rounded-2xl transition-all">
                    <X size={24} />
                  </button>
                </header>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="flex justify-center mb-6">
                    <ProfileImage 
                      size="lg" 
                      editable 
                      url={formData.logoUrl} 
                      onUpload={(url) => setFormData({...formData, logoUrl: url})} 
                      folder="schools"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] border-b border-blue-50 pb-2">Primary Identity</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Official Name</label>
                            <input
                                type="text" required
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                                placeholder="School Name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Phone</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900 font-mono"
                                placeholder="+1..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">School Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                                placeholder="contact@school.com"
                            />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] border-b border-emerald-50 pb-2">Economics & Ops</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Service Level</label>
                            <select
                                value={formData.plan}
                                onChange={(e) => setFormData({...formData, plan: e.target.value})}
                                className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                            >
                              <option value="BASIC">BASIC</option>
                              <option value="PRO">PRO</option>
                              <option value="PREMIUM">PREMIUM</option>
                              <option value="ENTERPRISE">ENTERPRISE</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Subscription Price ($)</label>
                            <input
                                type="number"
                                value={formData.subscriptionAmount}
                                onChange={(e) => setFormData({...formData, subscriptionAmount: Number(e.target.value)})}
                                className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Service Expiry</label>
                            <input
                                type="date"
                                value={formData.subscriptionEndDate || ''}
                                onChange={(e) => setFormData({...formData, subscriptionEndDate: e.target.value})}
                                className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Visibility</label>
                            <select
                                value={formData.subscriptionStatus}
                                onChange={(e) => setFormData({...formData, subscriptionStatus: e.target.value})}
                                className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                            >
                              <option value="ACTIVE">ACTIVE / UNLOCKED</option>
                              <option value="EXPIRED">EXPIRED / LOCKED</option>
                              <option value="PENDING">PENDING APPROVAL</option>
                            </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!editingId && (
                    <div className="space-y-6 pt-6 border-t border-gray-50">
                      <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] border-b border-indigo-50 pb-2">Master Administrator</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Admin Full Name</label>
                          <input type="text" required={!editingId} value={formData.adminName} onChange={(e) => setFormData({...formData, adminName: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900" placeholder="Juan Perez" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Login Email</label>
                          <input type="email" required={!editingId} value={formData.adminEmail} onChange={(e) => setFormData({...formData, adminEmail: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900" placeholder="admin@school.com" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Security Credential (Password)</label>
                          <input type="password" required={!editingId} value={formData.adminPassword} onChange={(e) => setFormData({...formData, adminPassword: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900" placeholder="••••••••" />
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="w-full py-5 bg-gray-900 text-white font-black uppercase tracking-[0.4em] text-[10px] rounded-[2rem] shadow-2xl hover:bg-black transition-all active:scale-95">
                    {editingId ? 'Push Manifest Updates' : 'Deploy Unified Tenant'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
