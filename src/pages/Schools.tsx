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
    plan: 'BASIC',
    logoUrl: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
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
      if (editingId) {
        await schoolService.update(editingId, formData);
      } else {
        await schoolService.create({ 
          ...formData, 
          userLimit: formData.plan === 'BASIC' ? 50 : formData.plan === 'PRO' ? 500 : 5000 
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
        plan: school.plan || 'BASIC',
        logoUrl: school.logoUrl || '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', address: '', phone: '', plan: 'BASIC', logoUrl: '', adminName: '', adminEmail: '', adminPassword: '' });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Schools</h1>
          <p className="text-gray-500">Manage multi-tenant school entities.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
        >
          <Plus size={18} />
          <span>New School</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400">
            <Loader2 className="animate-spin inline mr-2 text-blue-600" size={20} />
            Loading Schools...
          </div>
        ) : schools.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 font-medium lowercase">
            No schools registered in the system.
          </div>
        ) : (
          schools.map((school) => (
            <motion.div
              key={school.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center overflow-hidden border border-indigo-100">
                  {school.logoUrl ? (
                    <img src={school.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <SchoolIcon size={28} />
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openModal(school)}
                    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
                    title="Edit School"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(school.id)}
                    className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                    title="Delete School"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 truncate">{school.name}</h3>
              <p className="text-sm text-gray-500 mb-6 truncate">{school.address || 'No address provided'}</p>
              
              <div className="flex flex-col gap-2 pt-6 border-t border-gray-50">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <span>Contact</span>
                  <span className="text-gray-900">{school.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <span>ID</span>
                  <span className="text-gray-900 font-mono">{school.id.slice(0, 8)}...</span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-gray-900/10 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <header className="flex justify-between items-center mb-10">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{editingId ? 'Modify School' : 'Register School'}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-colors">
                    <X size={20} />
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
                  <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Entity Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                            placeholder="e.g. St. Peters Academy"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Physical Address</label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                            placeholder="Street, City"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Official Contact</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900 font-mono"
                            placeholder="+1 234 567 890"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Subscription Plan</label>
                        <select
                            value={formData.plan}
                            onChange={(e) => setFormData({...formData, plan: e.target.value})}
                            className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                        >
                          <option value="BASIC">BASIC (50 students)</option>
                          <option value="PRO">PRO (500 students)</option>
                          <option value="PREMIUM">PREMIUM (Unlimited)</option>
                        </select>
                    </div>

                    {!editingId && (
                      <>
                        <div className="pt-6 border-t border-gray-50">
                          <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 mb-4 ml-1">Initial Administrator</h3>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Admin Full Name</label>
                            <input
                              type="text"
                              required={!editingId}
                              value={formData.adminName}
                              onChange={(e) => setFormData({...formData, adminName: e.target.value})}
                              className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                              placeholder="School Admin Name"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Admin Email</label>
                            <input
                              type="email"
                              required={!editingId}
                              value={formData.adminEmail}
                              onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                              className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                              placeholder="admin@school.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Admin Password</label>
                            <input
                              type="password"
                              required={!editingId}
                              value={formData.adminPassword}
                              onChange={(e) => setFormData({...formData, adminPassword: e.target.value})}
                              className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                              placeholder="••••••••"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button
                      type="submit"
                      className="flex-1 py-5 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                    >
                      {editingId ? 'Update Entity' : 'Finalize Registration'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
