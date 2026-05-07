import React, { useState, useEffect } from 'react';
import { studentService, classService, schoolService } from '../services/api';
import { Plus, Search, MoreVertical, Edit2, Trash2, X, Check, Loader2, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProfileImage from '../components/ProfileImage';

export default function Students({ user }: { user: any }) {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    avatarUrl: '',
    admissionNumber: '',
    classId: '',
    schoolId: '',
    guardianName: '',
    guardianPhone: '',
    dateOfBirth: '',
    gender: 'MALE',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        studentService.list(),
        classService.list()
      ];

      if (user?.role === 'SUPER_ADMIN') {
        promises.push(schoolService.list());
      }

      const results = await Promise.all(promises);
      setStudents(results[0].data);
      setClasses(results[1].data);
      if (results[2]) setSchools(results[2].data);
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
        await studentService.update(editingId, formData);
      } else {
        await studentService.create(formData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', avatarUrl: '', admissionNumber: '', classId: '', schoolId: '', guardianName: '', guardianPhone: '', dateOfBirth: '', gender: 'MALE' });
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      console.error('Submit error:', err);
      alert(`Error: ${msg}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      await studentService.delete(id);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Delete failed';
      alert(`Error: ${msg}`);
    }
  };

  const openModal = (student?: any) => {
    if (student) {
      setEditingId(student.id);
      setFormData({
        name: student.name,
        avatarUrl: student.avatarUrl || '',
        admissionNumber: student.admissionNumber,
        classId: student.classId,
        schoolId: student.schoolId || '',
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        dateOfBirth: student.dateOfBirth || '',
        gender: student.gender || 'MALE',
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        avatarUrl: '', 
        admissionNumber: '', 
        classId: '', 
        schoolId: user?.role === 'SUPER_ADMIN' ? '' : (user?.schoolId || ''),
        guardianName: '', 
        guardianPhone: '', 
        dateOfBirth: '', 
        gender: 'MALE' 
      });
    }
    setIsModalOpen(true);
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.admissionNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Students</h1>
          <p className="text-gray-500">Manage student records and directory.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
        >
          <Plus size={20} />
          <span>Add Student</span>
        </button>
      </header>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-sm uppercase">
        <div className="p-4 border-b border-gray-50 flex items-center gap-3">
          <Search className="text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 focus:ring-0 outline-none p-2"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 text-xs font-bold tracking-widest border-b border-gray-50">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4 text-gray-500 font-mono">Admission #</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Guardian</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <Loader2 className="animate-spin inline mr-2" size={20} />
                    Loading students...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                    No results found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <ProfileImage url={student.avatarUrl} size="sm" />
                        <span className="font-bold text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono">{student.admissionNumber}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-[10px]">
                        {classes.find(c => c.id === student.classId)?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{student.guardianName}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button 
                          onClick={() => openModal(student)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(student.id)}
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
                  <h2>{editingId ? 'Edit Student' : 'New Student'}</h2>
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
                      folder="students"
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
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Admission Number</label>
                      <input
                        type="text"
                        required
                        value={formData.admissionNumber}
                        onChange={(e) => setFormData({...formData, admissionNumber: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Class</label>
                      <select
                        required
                        value={formData.classId}
                        onChange={(e) => setFormData({...formData, classId: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none appearance-none"
                      >
                        <option value="">Select Class</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    {user?.role === 'SUPER_ADMIN' && (
                      <div className="space-y-2">
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
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Guardian Name</label>
                      <input
                        type="text"
                        value={formData.guardianName}
                        onChange={(e) => setFormData({...formData, guardianName: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Guardian Phone</label>
                      <input
                        type="text"
                        value={formData.guardianPhone}
                        onChange={(e) => setFormData({...formData, guardianPhone: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      />
                    </div>
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
                      {editingId ? 'Save Changes' : 'Create Student'}
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
