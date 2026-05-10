import React, { useState, useEffect } from 'react';
import { classService, teacherService, schoolService } from '../services/api';
import { Plus, Edit2, Trash2, X, Loader2, BookOpen, GraduationCap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EDUCATION_LEVELS, LEVEL_CLASSES } from '../constants';

export default function Classes({ user }: { user: any }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(user?.schoolId || '');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    teacherId: '',
    schoolId: user?.schoolId || '',
  });

  useEffect(() => {
    fetchData();
  }, [selectedSchoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        classService.list({ schoolId: selectedSchoolId }),
        teacherService.list({ schoolId: selectedSchoolId })
      ];

      if (user?.role === 'SUPER_ADMIN') {
        promises.push(schoolService.list());
      }

      const results = await Promise.all(promises);
      setClasses(results[0].data);
      setTeachers(results[1].data);
      if (results[2]) setSchools(results[2].data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAddClasses = async (level: string) => {
    const classNames = LEVEL_CLASSES[level] || [];
    if (classNames.length === 0) return;
    
    if (!confirm(`Create ${classNames.length} standard classes for ${level}?`)) return;

    try {
      setLoading(true);
      for (const name of classNames) {
        // Only add if it doesn't exist
        const exists = classes.some(c => c.name === name && c.level === level);
        if (!exists) {
          await classService.create({
            name,
            level,
            schoolId: selectedSchoolId || user?.schoolId,
          });
        }
      }
      fetchData();
    } catch (err: any) {
      alert('Error during bulk operation');
      fetchData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await classService.update(editingId, formData);
      } else {
        await classService.create(formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      alert(`Error: ${msg}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return;
    try {
      await classService.delete(id);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Delete failed';
      alert(`Error: ${msg}`);
    }
  };

  const openModal = (cls?: any) => {
    if (cls) {
      setEditingId(cls.id);
      setFormData({
        name: cls.name,
        level: cls.level || '',
        teacherId: cls.teacherId || '',
        schoolId: cls.schoolId || '',
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        level: '',
        teacherId: '', 
        schoolId: user?.role === 'SUPER_ADMIN' ? '' : (user?.schoolId || '') 
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Classes</h1>
          <p className="text-gray-500">Manage school grades and groups.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          {user?.role === 'SUPER_ADMIN' && (
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="px-6 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
          >
            <Plus size={18} />
            <span>New Class</span>
          </button>
        </div>
      </header>

      {/* Quick Setup Bar */}
      <div className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Quick Setup:</span>
        {EDUCATION_LEVELS.map(l => (
          <button
            key={l.id}
            onClick={() => handleBulkAddClasses(l.id)}
            className="px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
          >
            + {l.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400">
            <Loader2 className="animate-spin inline mr-2" size={20} />
            Loading classes...
          </div>
        ) : classes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 font-medium">
            No classes defined yet.
          </div>
        ) : (
          classes.map((cls) => (
            <motion.div
              key={cls.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col gap-1">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <BookOpen size={24} />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{cls.level || 'UNSET'}</span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => openModal(cls)}
                    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                    title="Edit Class"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(cls.id)}
                    className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                    title="Delete Class"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{cls.name}</h3>
              <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-4">
                {teachers.find(t => t.id === cls.teacherId)?.name || 'No Class Teacher'}
              </p>
              <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
                <span>Education Level</span>
                <span className="text-gray-900">{EDUCATION_LEVELS.find(l => l.id === cls.level)?.name || 'Not Set'}</span>
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
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <header className="flex justify-between items-center mb-8 text-sm font-bold uppercase tracking-widest text-gray-900">
                  <h2>{editingId ? 'Edit Class' : 'New Class'}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Class Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm font-bold"
                      placeholder="e.g. Nursery 1-A"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Education Level</label>
                    <select
                      required
                      value={formData.level}
                      onChange={(e) => setFormData({...formData, level: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm font-bold appearance-none"
                    >
                      <option value="">Select Level</option>
                      {EDUCATION_LEVELS.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Class Teacher</label>
                    <select
                      value={formData.teacherId}
                      onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm font-bold appearance-none"
                    >
                      <option value="">Assign Teacher</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  {user?.role === 'SUPER_ADMIN' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">School</label>
                      <select
                        required
                        value={formData.schoolId}
                        onChange={(e) => setFormData({...formData, schoolId: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm font-bold appearance-none"
                      >
                        <option value="">Select School</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 text-gray-500 font-bold uppercase tracking-widest text-xs hover:bg-gray-50 rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                    >
                      {editingId ? 'Save changes' : 'Create Class'}
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
