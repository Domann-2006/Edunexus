import React, { useState, useEffect } from 'react';
import api, { teacherService, schoolService } from '../services/api';
import { Plus, Search, Edit2, Trash2, X, Loader2, User as UserIcon, Phone, MapPin, CheckCircle, BookOpen, Book } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProfileImage from '../components/ProfileImage';

const levelOrder = ['CRECHE', 'KINDERGARTEN', 'NURSERY', 'PRIMARY', 'JSS', 'SSS'];

const getLevel = (cls: any): string => {
  const level = (cls.level || cls.name || '').toUpperCase();
  if (level.includes('CRECHE')) return 'CRECHE';
  if (level.includes('KINDERGARTEN') || level.includes('KG')) return 'KINDERGARTEN';
  if (level.includes('NURSERY')) return 'NURSERY';
  if (level.includes('PRIMARY')) return 'PRIMARY';
  if (level.includes('JSS') || level.includes('JUNIOR')) return 'JSS';
  if (level.includes('SSS') || level.includes('SENIOR') || level.includes('SS')) return 'SSS';
  return 'OTHER';
};

const sortClasses = (classesList: any[]): any[] => {
  return [...classesList].sort((a, b) => {
    const levelA = getLevel(a);
    const levelB = getLevel(b);
    const levelDiff = (levelOrder.indexOf(levelA) === -1 ? 99 : levelOrder.indexOf(levelA)) -
                      (levelOrder.indexOf(levelB) === -1 ? 99 : levelOrder.indexOf(levelB));
    if (levelDiff !== 0) return levelDiff;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
};

export default function Teachers({ user }: { user: any }) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [formData, setFormData] = useState({
    name: '',
    avatarUrl: '',
    email: '',
    username: '',
    password: '',
    employeeId: '',
    specialization: '',
    phone: '',
    address: '',
    schoolId: '',
    assignedClasses: [] as string[],
    assignedSubjects: '',
    roleType: 'BOTH',
    classAssignments: [] as string[],
    subjectAssignments: [] as any[],
  });

  const [fetchedSubjects, setFetchedSubjects] = useState<any[]>([]);
  const [fetchedSessions, setFetchedSessions] = useState<any[]>([]);
  const [generatedCreds, setGeneratedCreds] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [selectedSchoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const targetSchoolId = selectedSchoolId || user?.schoolId;
      const promises: Promise<any>[] = [
        teacherService.list({ schoolId: targetSchoolId }),
        api.get('/v1/classes', { params: { schoolId: targetSchoolId } }),
        api.get('/v1/subjects', { params: { schoolId: targetSchoolId } }),
        api.get('/v1/sessions', { params: { schoolId: targetSchoolId } })
      ];
      if (user?.role === 'SUPER_ADMIN') {
        promises.push(schoolService.list());
      }
      const [teacherRes, classRes, subjectRes, sessionRes, schoolRes] = await Promise.all(promises);
      setTeachers(teacherRes.data);
      setClasses(sortClasses(classRes.data));
      setFetchedSubjects(subjectRes?.data || []);
      setFetchedSessions(sessionRes?.data || []);
      if (schoolRes) setSchools(schoolRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Calculate union of assigned classes for downstream compatibility
      const classTeacherIds = formData.roleType === 'CLASS' || formData.roleType === 'BOTH' ? formData.classAssignments : [];
      const subjectTeacherIds = formData.roleType === 'SUBJECT' || formData.roleType === 'BOTH' 
        ? formData.subjectAssignments.map(sa => sa.classId).filter(Boolean)
        : [];
      const finalClassIds = [...new Set([...classTeacherIds, ...subjectTeacherIds])];
      const finalSubjectNames = formData.roleType === 'SUBJECT' || formData.roleType === 'BOTH'
        ? [...new Set(formData.subjectAssignments.map(sa => sa.subjectName).filter(Boolean))]
        : [];

      const submitData = {
        ...formData,
        roleType: formData.roleType,
        classAssignments: formData.classAssignments,
        subjectAssignments: formData.subjectAssignments,
        assignedClassIds: finalClassIds,
        assignedSubjectIds: finalSubjectNames,
      };

      if (editingId) {
        await teacherService.update(editingId, submitData);
        setIsModalOpen(false);
      } else {
        const res = await teacherService.create(submitData);
        if (res.data.credentials) {
          setGeneratedCreds(res.data.credentials);
        } else {
          setIsModalOpen(false);
        }
      }
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

  const [isImageUploading, setIsImageUploading] = useState(false);

  const openModal = (teacher?: any) => {
    setGeneratedCreds(null);
    setIsImageUploading(false);
    if (teacher) {
      setEditingId(teacher.id);
      setFormData({
        name: teacher.name,
        avatarUrl: teacher.avatarUrl || '',
        email: teacher.email || '',
        username: teacher.username || '',
        password: '',
        employeeId: teacher.employeeId,
        specialization: teacher.specialization,
        phone: teacher.phone || '',
        address: teacher.address || '',
        schoolId: teacher.schoolId || '',
        assignedClasses: teacher.classAssignments || teacher.assignedClassIds || [],
        assignedSubjects: (teacher.assignedSubjectIds || []).join(', '),
        roleType: teacher.roleType || 'BOTH',
        classAssignments: teacher.classAssignments || teacher.assignedClassIds || [],
        subjectAssignments: teacher.subjectAssignments || [],
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        avatarUrl: '', 
        email: '', 
        username: '',
        password: '',
        employeeId: '', 
        specialization: '',
        phone: '',
        address: '',
        schoolId: user?.role === 'SUPER_ADMIN' ? '' : (user?.schoolId || ''),
        assignedClasses: [],
        assignedSubjects: '',
        roleType: 'BOTH',
        classAssignments: [],
        subjectAssignments: [],
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Teachers</h1>
          <p className="text-gray-500">Manage faculty and academic staff.</p>
        </div>
        <div className="flex flex-col md:flex-row flex-wrap gap-4">
          {user?.role === 'SUPER_ADMIN' && (
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="px-3 py-2.5 md:px-6 md:py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-3 py-2.5 md:px-6 md:py-3 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all font-bold uppercase tracking-widest text-xs"
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
                <th className="px-3 py-3 md:px-6 md:py-4">Teacher</th>
                <th className="px-3 py-3 md:px-6 md:py-4">Employee ID / Role</th>
                <th className="px-3 py-3 md:px-6 md:py-4">Assignments Summary</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-right">Actions</th>
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
                    <td className="px-3 py-3 md:px-6 md:py-4">
                      <div className="flex items-center gap-3">
                        <ProfileImage url={teacher.avatarUrl} size="sm" />
                        <div>
                          <div className="font-bold text-gray-900">{teacher.name}</div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <div className="text-[10px] text-gray-400 font-medium normal-case tracking-normal">{teacher.email}</div>
                            {teacher.phone && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-500 normal-case">
                                <Phone size={10} className="text-blue-400" />
                                {teacher.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-4">
                      <div className="space-y-1.5">
                        <div className="text-gray-500 font-mono text-xs">{teacher.employeeId}</div>
                        <div>
                          {(!teacher.roleType || teacher.roleType === 'BOTH') && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/50 rounded-full font-bold text-[9px] uppercase tracking-wide">
                              Both Roles
                            </span>
                          )}
                          {teacher.roleType === 'SUBJECT' && (
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100/50 rounded-full font-bold text-[9px] uppercase tracking-wide">
                              Subject Teacher
                            </span>
                          )}
                          {teacher.roleType === 'CLASS' && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100/50 rounded-full font-bold text-[9px] uppercase tracking-wide">
                              Class Teacher
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-4">
                      <div className="space-y-1.5 max-w-xs text-[10px] uppercase font-bold text-gray-400">
                        {(!teacher.roleType || teacher.roleType === 'CLASS' || teacher.roleType === 'BOTH') && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-gray-500 font-black shrink-0 text-[9px]">Class:</span>
                            {(teacher.classAssignments || teacher.assignedClassIds || []).length > 0 ? (
                              (teacher.classAssignments || teacher.assignedClassIds || []).map((cId: string) => {
                                const found = classes.find(c => c.id === cId);
                                return found ? (
                                  <span key={cId} className="px-1.5 py-0.5 bg-purple-50 border border-purple-100/50 text-purple-600 rounded-lg">
                                    {found.name}
                                  </span>
                                ) : null;
                              })
                            ) : (
                              <span className="text-gray-400 italic lowercase font-normal">none</span>
                            )}
                          </div>
                        )}
                        {(!teacher.roleType || teacher.roleType === 'SUBJECT' || teacher.roleType === 'BOTH') && (
                          <div className="flex flex-wrap gap-1 items-center mt-1">
                            <span className="text-gray-500 font-black shrink-0 text-[9px]">Subject:</span>
                            {(teacher.subjectAssignments || []).length > 0 ? (
                              (teacher.subjectAssignments || []).map((sa: any, index: number) => (
                                <span key={index} className="px-1.5 py-0.5 bg-amber-50 border border-amber-100/50 text-amber-600 rounded-lg" title={`${sa.subjectName} for class ${sa.className}`}>
                                  {sa.subjectName} ({sa.className})
                                </span>
                              ))
                            ) : (
                              (teacher.assignedSubjectIds || []).length > 0 ? (
                                (teacher.assignedSubjectIds || []).map((name: string, index: number) => (
                                  <span key={index} className="px-1.5 py-0.5 bg-amber-50 border border-amber-100/50 text-amber-600 rounded-lg">
                                    {name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 italic lowercase font-normal text-[9px]">none</span>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-4 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button 
                          onClick={() => openModal(teacher)}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                          title="Edit Teacher"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(teacher.id)}
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                          title="Delete Teacher"
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
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <header className="flex justify-between items-center mb-8 text-sm font-bold uppercase tracking-widest text-gray-900">
                  <h2>{editingId ? 'Edit Teacher' : 'New Teacher'}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </header>

                {generatedCreds ? (
                  <div className="space-y-6 text-center">
                    <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                      <div className="text-green-600 font-bold mb-2">Teacher Account Created!</div>
                      <p className="text-sm text-green-700">Please provide these credentials to the teacher:</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 text-left">
                      <div className="p-4 bg-gray-50 rounded-2xl">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Email Address</label>
                        <div className="font-mono text-blue-600 font-bold">{generatedCreds.email}</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Temporary Password</label>
                        <div className="font-mono text-red-600 font-bold">{generatedCreds.password}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="w-full py-4 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-700 transition-all"
                    >
                      Got it, close
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex justify-center mb-6">
                      <ProfileImage 
                        size="xl" 
                        editable 
                        url={formData.avatarUrl} 
                        onUpload={(url) => setFormData({...formData, avatarUrl: url})} 
                        onUploadingChange={setIsImageUploading}
                        folder="teachers"
                        showCamera={true}
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
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gmail Address</label>
                        <input
                          type="email"
                          required={!editingId}
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Username</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({...formData, username: e.target.value})}
                          placeholder="Leave blank to use email"
                          className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                        />
                      </div>
                      {!editingId && (
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                          <input
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            placeholder="Set a secure password"
                            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Role Type</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { value: 'SUBJECT', label: 'Subject Teacher', desc: 'Teaches assigned subjects' },
                            { value: 'CLASS', label: 'Class Teacher', desc: 'Manages a specific class' },
                            { value: 'BOTH', label: 'Both (Subject + Class)', desc: 'Full teaching & management' }
                          ].map(opt => (
                            <div
                              key={opt.value}
                              onClick={() => {
                                setFormData({ 
                                  ...formData, 
                                  roleType: opt.value
                                });
                              }}
                              className={`cursor-pointer flex flex-col p-4 rounded-2xl border transition-all ${
                                formData.roleType === opt.value 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                                  : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100/50'
                              }`}
                            >
                              <span className="text-xs font-black uppercase tracking-wider">{opt.label}</span>
                              <span className={`text-[9px] mt-1 ${formData.roleType === opt.value ? 'text-blue-100' : 'text-gray-400 font-medium'}`}>{opt.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {(formData.roleType === 'CLASS' || formData.roleType === 'BOTH') && (
                        <div className="space-y-3 md:col-span-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Class Teacher Assignments</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-3xl max-h-48 overflow-y-auto border border-gray-100">
                             {sortClasses(classes).map(c => {
                               const isSelected = formData.classAssignments.includes(c.id);
                               return (
                                 <div 
                                   key={c.id} 
                                   onClick={() => {
                                     const newClasses = isSelected 
                                       ? formData.classAssignments.filter(id => id !== c.id)
                                       : [...formData.classAssignments, c.id];
                                     setFormData({ ...formData, classAssignments: newClasses });
                                   }}
                                   className={`cursor-pointer group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                     isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-600 hover:border-purple-200'
                                   }`}
                                 >
                                   <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                     isSelected ? 'bg-white border-white' : 'bg-gray-100 border-gray-200 group-hover:border-purple-300'
                                   }`}>
                                     {isSelected && <CheckCircle size={10} className="text-purple-600" />}
                                   </div>
                                   <div className="flex flex-col">
                                     <span className="text-[10px] font-black tracking-tight leading-none uppercase">{c.name}</span>
                                     <span className={`text-[8px] font-bold ${isSelected ? 'text-purple-100' : 'text-gray-400'}`}>{c.level}</span>
                                   </div>
                                 </div>
                               );
                             })}
                          </div>
                          <p className="text-[9px] text-gray-400 font-medium px-2 italic font-sans">Select one or multiple classes where this teacher is the designated Class Teacher.</p>
                        </div>
                      )}

                      {(formData.roleType === 'SUBJECT' || formData.roleType === 'BOTH') && (
                        <div className="space-y-4 md:col-span-2">
                          <div className="flex justify-between items-center ml-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subject Teacher Assignments</label>
                            <button
                              type="button"
                              onClick={() => {
                                const firstSession = fetchedSessions[0];
                                const newAssign = {
                                  subjectId: '',
                                  subjectName: '',
                                  classId: '',
                                  className: '',
                                  sessionId: firstSession?.id || '',
                                  sessionName: firstSession?.name || '',
                                };
                                setFormData({
                                  ...formData,
                                  subjectAssignments: [...formData.subjectAssignments, newAssign]
                                });
                              }}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                            >
                              <Plus size={12} /> Add Subject Assignment
                            </button>
                          </div>

                          <div className="space-y-3">
                            {formData.subjectAssignments.length === 0 ? (
                              <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center text-gray-400">
                                <Book size={18} className="mx-auto mb-2 text-gray-300" />
                                <p className="text-[10px] uppercase font-bold text-gray-400/80 tracking-wider">No Subject Assignments Added</p>
                                <p className="text-[9px] mt-0.5 lowercase italic font-normal">Click "+ Add Subject Assignment" above to map a subject, class, academic session, and term.</p>
                              </div>
                            ) : (
                              formData.subjectAssignments.map((sa, idx) => {
                                const classSubjects = sa.classId
                                  ? fetchedSubjects.filter(s => s.classId === sa.classId || s.class === classes.find(c => c.id === sa.classId)?.name)
                                  : [];

                                const isSubjectDisabled = !sa.classId || classSubjects.length === 0;
                                const subjectPlaceholder = !sa.classId 
                                  ? 'Select class first' 
                                  : (classSubjects.length === 0 ? 'No subjects for this class' : 'Select Subject');

                                return (
                                  <div key={idx} className="p-4 bg-gray-50 border border-gray-100 rounded-3xl relative space-y-4 shadow-sm animate-fade-in">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs uppercase font-extrabold text-gray-700">
                                      <div>
                                        <label className="text-[9px] text-gray-400 uppercase font-black leading-none mb-1 block">Class</label>
                                        <select
                                          required
                                          value={sa.classId || ''}
                                          onChange={(e) => {
                                            const cId = e.target.value;
                                            const found = classes.find(c => c.id === cId);
                                            const updated = [...formData.subjectAssignments];
                                            updated[idx] = { 
                                              ...sa, 
                                              classId: cId, 
                                              className: found ? found.name : '',
                                              subjectId: '',
                                              subjectName: ''
                                            };
                                            setFormData({ ...formData, subjectAssignments: updated });
                                          }}
                                          className="w-full px-3 py-2 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-xs"
                                        >
                                          <option value="">Select Class</option>
                                          {sortClasses(classes).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-gray-400 uppercase font-black leading-none mb-1 block">Subject</label>
                                        <select
                                          required
                                          disabled={isSubjectDisabled}
                                          value={sa.subjectId || ''}
                                          onChange={(e) => {
                                            const subId = e.target.value;
                                            const found = fetchedSubjects.find(s => s.id === subId);
                                            const updated = [...formData.subjectAssignments];
                                            updated[idx] = { 
                                              ...sa, 
                                              subjectId: subId, 
                                              subjectName: found ? found.name : '' 
                                            };
                                            setFormData({ ...formData, subjectAssignments: updated });
                                          }}
                                          className="w-full px-3 py-2 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-xs disabled:opacity-60 disabled:bg-gray-100"
                                        >
                                          <option value="">{subjectPlaceholder}</option>
                                          {classSubjects.map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.name} ({sub.class})</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-gray-400 uppercase font-black leading-none mb-1 block">Session</label>
                                        <select
                                          required
                                          value={sa.sessionId || ''}
                                          onChange={(e) => {
                                            const sId = e.target.value;
                                            const found = fetchedSessions.find(s => s.id === sId);
                                            const updated = [...formData.subjectAssignments];
                                            updated[idx] = { 
                                              ...sa, 
                                              sessionId: sId, 
                                              sessionName: found ? found.name : '' 
                                            };
                                            setFormData({ ...formData, subjectAssignments: updated });
                                          }}
                                          className="w-full px-3 py-2 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-xs"
                                        >
                                          <option value="">Select Session</option>
                                          {fetchedSessions.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-gray-400 uppercase font-black leading-none mb-1 block">Term</label>
                                        <select
                                          value={sa.term || ''}
                                          onChange={(e) => {
                                            const updated = [...formData.subjectAssignments];
                                            updated[idx] = { ...sa, term: e.target.value || undefined };
                                            setFormData({ ...formData, subjectAssignments: updated });
                                          }}
                                          className="w-full px-3 py-2 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-xs"
                                        >
                                          <option value="">All Terms</option>
                                          <option value="First Term">First Term</option>
                                          <option value="Second Term">Second Term</option>
                                          <option value="Third Term">Third Term</option>
                                        </select>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = formData.subjectAssignments.filter((_, i) => i !== idx);
                                        setFormData({ ...formData, subjectAssignments: updated });
                                      }}
                                      className="absolute -top-1.5 -right-1.5 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                      title="Delete Assignment"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Specialization</label>
                         <input
                          type="text"
                          value={formData.specialization}
                          onChange={(e) => setFormData({...formData, specialization: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                          placeholder="e.g. Mathematics, Physics"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number</label>
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                          placeholder="+234 ..."
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Home Address</label>
                        <textarea
                          value={formData.address}
                          onChange={(e) => setFormData({...formData, address: e.target.value})}
                          rows={2}
                          className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none"
                          placeholder="Residential address"
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
                        disabled={isImageUploading}
                        className={`flex-1 py-4 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-blue-100 transition-all ${isImageUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                      >
                        {isImageUploading ? 'Uploading Image...' : (editingId ? 'Save Changes' : 'Add Teacher')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
