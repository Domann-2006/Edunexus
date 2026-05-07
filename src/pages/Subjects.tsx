import React, { useState, useEffect } from 'react';
import { subjectService, schoolService } from '../services/api';
import { Plus, Edit2, Trash2, X, Loader2, Book } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Subjects({ user }: { user: any }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    schoolId: '',
  });

  useEffect(() => {
    fetchData();
  }, [selectedSchoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [subjectService.list({ schoolId: selectedSchoolId })];
      if (user?.role === 'SUPER_ADMIN') {
        promises.push(schoolService.list());
      }
      const results = await Promise.all(promises);
      setSubjects(results[0].data);
      if (results[1]) setSchools(results[1].data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await subjectService.update(editingId, formData);
      } else {
        await subjectService.create(formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      console.error('Submit error:', err);
      alert(`Error: ${msg}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      await subjectService.delete(id);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Delete failed';
      alert(`Error: ${msg}`);
    }
  };

  const openModal = (sub?: any) => {
    if (sub) {
      setEditingId(sub.id);
      setFormData({ 
        name: sub.name,
        schoolId: sub.schoolId || '',
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        schoolId: user?.role === 'SUPER_ADMIN' ? '' : (user?.schoolId || '') 
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-sans">Subjects</h1>
          <p className="text-gray-500">Academic curriculum management.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          {user?.role === 'SUPER_ADMIN' && (
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="px-6 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none uppercase tracking-widest"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
          >
            <Plus size={18} />
            <span>New Subject</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400">
            <Loader2 className="animate-spin inline mr-2" size={20} />
            Loading subjects...
          </div>
        ) : subjects.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 font-medium lowercase italic">
            no subjects defined.
          </div>
        ) : (
          subjects.map((sub) => (
            <motion.div
              key={sub.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <Book size={20} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openModal(sub)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">{sub.name}</h3>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden p-10">
              <h2 className="text-xl font-bold text-gray-900 mb-8">{editingId ? 'Edit Subject' : 'New Subject'}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-bold"
                    placeholder="e.g. Mathematics"
                  />
                </div>
                {user?.role === 'SUPER_ADMIN' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School</label>
                    <select
                      required
                      value={formData.schoolId}
                      onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-bold appearance-none"
                    >
                      <option value="">Select School</option>
                      {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <button type="submit" className="w-full py-5 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
