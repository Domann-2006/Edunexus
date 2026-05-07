import React, { useState, useEffect } from 'react';
import { teacherService, schoolService } from '../services/api';
import { Plus, Search, Edit2, Trash2, X, Loader2, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProfileImage from '../components/ProfileImage';

export default function Teachers({ user }: { user: any }) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    avatarUrl: '',
    email: '',
    employeeId: '',
    specialization: '',
    schoolId: '',
  });

  useEffect(() => {
    fetchData();
  }, [selectedSchoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [teacherService.list({ schoolId: selectedSchoolId })];
      if (user?.role === 'SUPER_ADMIN') {
        promises.push(schoolService.list());
      }
      const results = await Promise.all(promises);
      setTeachers(results[0].data);
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
        await teacherService.update(editingId, formData);
      } else {
        await teacherService.create(formData);
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
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    try {
      await teacherService.delete(id);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Delete failed';
      alert(`Error: ${msg}`);
    }
  };

  const openModal = (teacher?: any) => {
    if (teacher) {
      setEditingId(teacher.id);
      setFormData({
        name: teacher.name,
        avatarUrl: teacher.avatarUrl || '',
        email: teacher.email || '',
        employeeId: teacher.employeeId,
        specialization: teacher.specialization,
        schoolId: teacher.schoolId || '',
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        avatarUrl: '', 
        email: '', 
        employeeId: '', 
        specialization: '',
        schoolId: user?.role === 'SUPER_ADMIN' ? '' : (user?.schoolId || '')
      });
    }
    setIsModalOpen(true);
  };

  const filtered = teachers.filter(t => 
    t.name?.toLowerCase().includes(search.toLowerCase()) || 
    t.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Teachers</h1>
          <p className="text-gray-500">Manage faculty and academic staff.</p>
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all font-bold uppercase tracking-widest text-xs"
          >
            <Plus size={18} />
            <span>Add Teacher</span>
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-sm uppercase">
        <div className="p-4 border-b border-gray-50 flex items-center gap-3">
          <Search className="text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search teachers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 focus:ring-0 outline-none p-2"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 text-xs font-bold tracking-widest border-b border-gray-50">
              <tr>
                <th className="px-6 py-4">Teacher</th>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Specialization</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 uppercase tracking-tight">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <Loader2 className="animate-spin inline mr-2 text-blue-600" size={20} />
                    Processing...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium lowercase">
                    No teacher records found.
                  </td>
                </tr>
              ) : (
                filtered.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <ProfileImage url={teacher.avatarUrl} size="sm" />
                        <div>
                          <div className="font-bold text-gray-900">{teacher.name}</div>
                          <div className="text-[10px] text-gray-400 font-medium normal-case tracking-normal">{teacher.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{teacher.employeeId}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full font-bold text-[10px]">
                        {teacher.specialization}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button 
                          onClick={() => openModal(teacher)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(teacher.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <header className="flex justify-between items-center mb-8 text-sm font-bold uppercase tracking-widest text-gray-900">
                  <h2>{editingId ? 'Edit Teacher' : 'New Teacher'}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex justify-center mb-6">
                    <ProfileImage 
                      size="xl" 
                      editable 
                      url={formData.avatarUrl} 
                      onUpload={(url) => setFormData({...formData, avatarUrl: url})} 
                      folder="teachers"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Employee ID</label>
                      <input
                        type="text"
                        required
                        value={formData.employeeId}
                        onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Specialization</label>
                      <input
                        type="text"
                        value={formData.specialization}
                        onChange={(e) => setFormData({...formData, specialization: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                        placeholder="e.g. Mathematics, Physics"
                      />
                    </div>
                    {user?.role === 'SUPER_ADMIN' && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">School</label>
                        <select
                          required
                          value={formData.schoolId}
                          onChange={(e) => setFormData({...formData, schoolId: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none appearance-none"
                        >
                          <option value="">Select School</option>
                          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

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
                      {editingId ? 'Save Changes' : 'Add Teacher'}
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
