import React, { useState, useEffect } from 'react';
import { subjectService, schoolService } from '../services/api';
import { Plus, Edit2, Trash2, X, Loader2, Book, GraduationCap, Layers, Sparkles, Filter, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EDUCATION_LEVELS, LEVEL_CLASSES, SSS_STREAMS, DEFAULT_SUBJECTS } from '../constants';

export default function Subjects({ user }: { user: any }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(user?.schoolId || '');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('GENERAL');
  
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{ added: number; skipped: number; total: number } | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  const [formData, setFormData] = useState({
    name: '',
    schoolId: user?.schoolId || '',
    level: '',
    class: '',
    stream: 'GENERAL',
  });

  useEffect(() => {
    fetchData();
  }, [selectedSchoolId, selectedLevel, selectedClass, selectedStream]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { 
        schoolId: selectedSchoolId,
        level: selectedLevel,
        class: selectedClass,
      };
      if (selectedLevel === 'SSS') {
        params.stream = selectedStream;
      }
      
      const promises: Promise<any>[] = [subjectService.list(params)];
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
      setToast({ message: `Subject ${editingId ? 'updated' : 'created'} successfully`, type: 'success' });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      setToast({ message: `Error: ${msg}`, type: 'error' });
    }
  };

  const handleBulkAdd = async (level: string, className: string, stream: string) => {
    const streamKey = level === 'SSS' ? stream : 'DEFAULT';
    const defaults = DEFAULT_SUBJECTS[level]?.[streamKey] || [];
    
    if (defaults.length === 0) {
      setToast({ message: 'No standard subjects defined for this level yet.', type: 'info' });
      return;
    }
    
    setLoading(true);
    try {
      const response = await subjectService.bulkCreate({
        subjects: defaults,
        schoolId: selectedSchoolId || user?.schoolId,
        level,
        class: className,
        stream: level === 'SSS' ? stream : 'GENERAL'
      });
      
      setBulkSummary({
        added: response.data.addedCount,
        skipped: response.data.skippedCount,
        total: defaults.length
      });
      fetchData();
    } catch (err: any) {
      console.error('Bulk add failed:', err);
      setToast({ message: `Error adding subjects: ${err.response?.data?.message || err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      await subjectService.delete(id);
      fetchData();
      setToast({ message: 'Subject deleted successfully', type: 'success' });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Delete failed';
      setToast({ message: `Delete failed: ${msg}`, type: 'error' });
    }
  };

  const openModal = (sub?: any) => {
    if (sub) {
      setEditingId(sub.id);
      setFormData({ 
        name: sub.name,
        schoolId: sub.schoolId || '',
        level: sub.level || '',
        class: sub.class || '',
        stream: sub.stream || 'GENERAL',
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        schoolId: user?.role === 'SUPER_ADMIN' ? '' : (user?.schoolId || ''),
        level: selectedLevel,
        class: selectedClass,
        stream: selectedStream || 'GENERAL',
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Academic Hierarchy</h1>
          <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Nigerian Curriculum Management</p>
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
          {isAdmin && (
            <button 
              onClick={() => openModal()}
              className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white font-bold uppercase tracking-widest text-[10px] rounded-2xl shadow-xl hover:bg-black transition-all group active:scale-95"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform" />
              <span>Add Single Subject</span>
            </button>
          )}
        </div>
      </header>

      {/* Modern Hierarchical Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Level List */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4 px-2">
            <GraduationCap size={16} className="text-blue-500" />
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">1. Education Level</h3>
          </div>
          <div className="space-y-2">
            {EDUCATION_LEVELS.map(level => (
              <button
                key={level.id}
                onClick={() => {
                  setSelectedLevel(level.id);
                  setSelectedClass('');
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  selectedLevel === level.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span>{level.name}</span>
                {selectedLevel === level.id && <ChevronRight size={16} />}
              </button>
            ))}
          </div>
        </div>

        {/* Class List */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Layers size={16} className="text-purple-500" />
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">2. Select Class</h3>
          </div>
          {!selectedLevel ? (
            <div className="h-full flex items-center justify-center text-center p-6 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-400 font-medium lowercase italic">select a level first</p>
            </div>
          ) : (
            <div className="space-y-2">
              {LEVEL_CLASSES[selectedLevel].map(cls => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    selectedClass === cls 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' 
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span>{cls}</span>
                  {selectedClass === cls && <ChevronRight size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stream / Action Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm min-h-[200px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">3. Subjects Listing</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-gray-900 tracking-tight">{selectedClass || 'No Class Selected'}</span>
                  {selectedLevel === 'SSS' && (
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                      {SSS_STREAMS.map(stream => (
                        <button
                          key={stream.id}
                          onClick={() => setSelectedStream(stream.id)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${
                            selectedStream === stream.id 
                              ? 'bg-white text-blue-600 shadow-sm' 
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {stream.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedClass && isAdmin && (
                <button 
                  onClick={() => handleBulkAdd(selectedLevel, selectedClass, selectedStream)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <Sparkles size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Suggest Standard Subjects</span>
                </button>
              )}
            </div>

            <div className="flex-1">
              {loading ? (
                <div className="h-full flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              ) : !selectedClass ? (
                <div className="h-full flex items-center justify-center text-center p-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                  <div className="space-y-3">
                    <Filter className="mx-auto text-gray-300" size={40} />
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select class to view curriculum</p>
                  </div>
                </div>
              ) : subjects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                  <Book className="text-gray-300 mb-4" size={48} />
                  <p className="text-sm text-gray-400 font-medium mb-4">No subjects found for this class.</p>
                  {isAdmin && (
                    <button 
                      onClick={() => handleBulkAdd(selectedLevel, selectedClass, selectedStream)}
                      className="px-6 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm"
                    >
                      Auto-populate standard subjects
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {subjects.map((sub) => (
                    <motion.div
                      key={sub.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between group hover:bg-white hover:shadow-xl hover:shadow-blue-900/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transform group-hover:scale-110 transition-transform">
                          <Book size={14} />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{sub.name}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 transition-opacity">
                          <button 
                            onClick={() => openModal(sub)} 
                            className="p-2 text-blue-600 hover:bg-blue-50 bg-white shadow-sm rounded-lg border border-gray-100 transition-all active:scale-90"
                            title="Edit Subject"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(sub.id)} 
                            className="p-2 text-red-600 hover:bg-red-50 bg-white shadow-sm rounded-lg border border-gray-100 transition-all active:scale-90"
                            title="Delete Subject"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {bulkSummary && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setBulkSummary(null)} 
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="relative w-full max-w-sm bg-white rounded-[3rem] shadow-2xl overflow-hidden p-10 text-center"
            >
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${bulkSummary.added > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {bulkSummary.added > 0 ? <CheckCircle2 size={40} /> : <AlertTriangle size={40} />}
              </div>
              
              <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">Subject Auto-Sync</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-8">Process complete for {selectedClass}</p>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="text-2xl font-black text-emerald-600">{bulkSummary.added}</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Added</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="text-2xl font-black text-amber-500">{bulkSummary.skipped}</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Skipped</div>
                </div>
              </div>

              <button 
                onClick={() => setBulkSummary(null)}
                className="w-full py-4 bg-gray-900 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl hover:bg-black transition-all"
              >
                Continue Management
              </button>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden p-12">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{editingId ? 'Edit Subject' : 'Add Subject'}</h2>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Curriculum Management</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Subject Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-bold text-gray-700"
                      placeholder="e.g. Mathematics"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Level</label>
                    <select
                      required
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: e.target.value, class: '' })}
                      className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-bold text-gray-700 appearance-none"
                    >
                      <option value="">Select Level</option>
                      {EDUCATION_LEVELS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Class</label>
                    <select
                      required
                      disabled={!formData.level}
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-bold text-gray-700 appearance-none disabled:opacity-50"
                    >
                      <option value="">Select Class</option>
                      {formData.level && LEVEL_CLASSES[formData.level].map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  {formData.level === 'SSS' && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">SSS Stream</label>
                      <div className="flex gap-2">
                        {SSS_STREAMS.map(stream => (
                          <button
                            key={stream.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, stream: stream.id })}
                            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                              formData.stream === stream.id 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                                : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                            }`}
                          >
                            {stream.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {user?.role === 'SUPER_ADMIN' && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">School</label>
                      <select
                        required
                        value={formData.schoolId}
                        onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                        className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-bold text-gray-700 appearance-none"
                      >
                        <option value="">Select School</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <button type="submit" className="w-full py-5 bg-gray-900 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-2xl hover:bg-black transition-all active:scale-95 mt-6">
                  {editingId ? 'Update Subject' : 'Save Subject'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' :
              toast.type === 'error' ? 'bg-rose-600 border-rose-500 text-white' :
              'bg-gray-900 border-gray-800 text-white'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : 
               toast.type === 'error' ? <AlertTriangle size={18} /> : <Book size={18} />}
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

