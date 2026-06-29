import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { studentService, classService, schoolService, teacherService, cacheEvents } from '../services/api';
import { Plus, Search, MoreVertical, Edit2, Trash2, X, Check, Loader2, User as UserIcon, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProfileImage from '../components/ProfileImage';
import { SSS_STREAMS } from '../constants';
import { Download, FileText, CheckSquare, AlertCircle } from 'lucide-react';

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

export default function Students({ user }: { user: any }) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(user?.schoolId || '');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClassIdFilter, setSelectedClassIdFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  
  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isTeacher = user?.role === 'TEACHER';
  const canManage = isAdmin || isTeacher;

  const [searchParams] = useSearchParams();
  
  const [formData, setFormData] = useState({
    name: '',
    avatarUrl: '',
    admissionNumber: '',
    classId: '',
    stream: 'GENERAL',
    schoolId: user?.schoolId || '',
    guardianName: '',
    guardianPhone: '',
    dateOfBirth: '',
    gender: 'MALE',
  });

  useEffect(() => {
    if (isTeacher && classes.length > 0 && !formData.classId && !editingId) {
      // If teacher has only one class, auto-select it
      if (classes.length === 1) {
        setFormData(prev => ({ ...prev, classId: classes[0].id }));
      }
    }
  }, [classes, isTeacher, editingId]);

  useEffect(() => {
    const classIdFromUrl = searchParams.get('classId');
    if (classIdFromUrl) {
      setSelectedClassIdFilter(classIdFromUrl);
    }
    fetchData();
  }, [selectedSchoolId, searchParams]);

  const fetchDataSilently = async () => {
    try {
      const promises: Promise<any>[] = [
        studentService.list({ schoolId: selectedSchoolId }),
        classService.list({ schoolId: selectedSchoolId })
      ];

      if (user?.role === 'SUPER_ADMIN') {
        promises.push(schoolService.list());
      }

      const results = await Promise.all(promises);
      let fetchedStudents = results[0].data;
      let fetchedClasses = results[1].data;

      if (user?.role === 'TEACHER') {
        const profileRes = await teacherService.list({ userId: user.id });
        if (profileRes.data.length > 0) {
          const profile = profileRes.data[0];
          const classIdentifiers = profile.assignedClassIds || [];
          
          if (classIdentifiers.length > 0) {
            fetchedClasses = fetchedClasses.filter((c: any) => 
              classIdentifiers.includes(c.id) || 
              classIdentifiers.includes(c.name)
            );
            const resolvedIds = fetchedClasses.map((c: any) => c.id);
            fetchedStudents = fetchedStudents.filter((s: any) => resolvedIds.includes(s.classId));
          } else {
            fetchedClasses = [];
            fetchedStudents = [];
          }
        }
      }

      if (user?.roleType === 'SUBJECT') {
        fetchedStudents = fetchedStudents.filter((student: any) => 
          user?.assignedClassIds?.includes(student.classId) &&
          user?.subjectIds?.some((subjectId: string) => student.enrolledSubjects?.includes(subjectId))
        );
      }

      setStudents(fetchedStudents);
      setClasses(sortClasses(fetchedClasses));
      if (results[2]) setSchools(results[2].data);
    } catch (err) {
      console.debug('Background silent student fetch skipped:', err);
    }
  };

  useEffect(() => {
    // Import cacheEvents dynamically or reference it from custom imports
    const unsubscribe = cacheEvents.subscribe((eventKey) => {
      if (eventKey === 'cache_updated' || eventKey === 'sync_completed' || eventKey.includes('/v1/students') || eventKey.includes('/v1/classes')) {
        fetchDataSilently();
      }
    });
    return unsubscribe;
  }, [selectedSchoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        studentService.list({ schoolId: selectedSchoolId }),
        classService.list({ schoolId: selectedSchoolId })
      ];

      if (user?.role === 'SUPER_ADMIN') {
        promises.push(schoolService.list());
      }

      const results = await Promise.all(promises);
      let fetchedStudents = results[0].data;
      let fetchedClasses = results[1].data;

      if (user?.role === 'TEACHER') {
        const profileRes = await teacherService.list({ userId: user.id });
        if (profileRes.data.length > 0) {
          const profile = profileRes.data[0];
          const classIdentifiers = profile.assignedClassIds || [];
          
          if (classIdentifiers.length > 0) {
            // Filter classes by ID or Name (since it might be names)
            fetchedClasses = fetchedClasses.filter((c: any) => 
              classIdentifiers.includes(c.id) || 
              classIdentifiers.includes(c.name)
            );
            
            // The backend already filters students if it detects a TEACHER role, 
            // but we can double check here or just rely on backend.
            const resolvedIds = fetchedClasses.map((c: any) => c.id);
            fetchedStudents = fetchedStudents.filter((s: any) => resolvedIds.includes(s.classId));
          } else {
            fetchedClasses = [];
            fetchedStudents = [];
          }
        }
      }

      if (user?.roleType === 'SUBJECT') {
        fetchedStudents = fetchedStudents.filter((student: any) => 
          user?.assignedClassIds?.includes(student.classId) &&
          user?.subjectIds?.some((subjectId: string) => student.enrolledSubjects?.includes(subjectId))
        );
      }

      setStudents(fetchedStudents);
      setClasses(sortClasses(fetchedClasses));
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
      setFormData({ name: '', avatarUrl: '', admissionNumber: '', classId: '', stream: 'GENERAL', schoolId: user?.schoolId || '', guardianName: '', guardianPhone: '', dateOfBirth: '', gender: 'MALE' });
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      showToast(msg, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      await studentService.delete(id);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Delete failed';
      showToast(msg, 'error');
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
        stream: student.stream || 'GENERAL',
        schoolId: student.schoolId || '',
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        dateOfBirth: student.dateOfBirth || '',
        gender: student.gender || 'MALE',
      });
    } else {
      setEditingId(null);
      setIsImageUploading(false);
      setFormData({ 
        name: '', 
        avatarUrl: '', 
        admissionNumber: '', 
        classId: '', 
        stream: 'GENERAL',
        schoolId: user?.role === 'SUPER_ADMIN' ? '' : (user?.schoolId || ''),
        guardianName: '', 
        guardianPhone: '', 
        dateOfBirth: '', 
        gender: 'MALE' 
      });
    }
    setIsModalOpen(true);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || 
                          s.admissionNumber?.toLowerCase().includes(search.toLowerCase());
    const matchesClass = selectedClassIdFilter ? s.classId === selectedClassIdFilter : true;
    return matchesSearch && matchesClass;
  });

  const exportCSV = () => {
    const headers = ['Name', 'Admission Number', 'Class', 'Level', 'Gender', 'Date of Birth', 'Guardian Name', 'Guardian Phone'];
    const rows = filteredStudents.map(s => {
      const cls = classes.find(c => c.id === s.classId);
      return [
        s.name || '',
        s.admissionNumber || '',
        cls?.name || 'Unassigned',
        cls?.level || '',
        s.gender || '',
        s.dateOfBirth || '',
        s.guardianName || '',
        s.guardianPhone || ''
      ];
    });
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const className = classes.find(c => c.id === selectedClassIdFilter)?.name || 'All Classes';
    link.href = url;
    link.download = `EduNexus_Students_${className}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const className = classes.find(c => c.id === selectedClassIdFilter)?.name || 'All Classes';
    const schoolName = user?.schoolName || 'School';
    const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const tableRows = filteredStudents.map((s, index) => {
      const cls = classes.find(c => c.id === s.classId);
      return `
        <tr style="background:${index % 2 === 0 ? '#f9fafb' : '#ffffff'}">
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:600">${index + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:700">${s.name || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;color:#6b7280">${s.admissionNumber || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">${cls?.name || 'Unassigned'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">${s.gender || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">${s.dateOfBirth || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">${s.guardianName || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">${s.guardianPhone || '-'}</td>
        </tr>`;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Student List - ${className}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', Arial, sans-serif; color: #111827; background: white; padding: 32px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #2563eb; }
          .brand { font-size: 28px; font-weight: 900; color: #2563eb; letter-spacing: -1px; font-style: italic; }
          .meta { text-align: right; font-size: 12px; color: #6b7280; }
          .meta strong { display: block; font-size: 18px; color: #111827; font-weight: 800; margin-bottom: 4px; }
          .stats { display: flex; gap: 16px; margin-bottom: 24px; }
          .stat { background: #eff6ff; border-radius: 12px; padding: 12px 20px; }
          .stat-number { font-size: 24px; font-weight: 900; color: #2563eb; }
          .stat-label { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          thead { background: #1e40af; color: white; }
          th { padding: 12px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">EduNexus</div>
          <div class="meta">
            <strong>${schoolName}</strong>
            Student List — ${className}<br/>
            Generated: ${printDate}
          </div>
        </div>
        <div class="stats">
          <div class="stat">
            <div class="stat-number">${filteredStudents.length}</div>
            <div class="stat-label">Total Students</div>
          </div>
          <div class="stat">
            <div class="stat-number">${className}</div>
            <div class="stat-label">Class / Filter</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Full Name</th>
              <th>Admission No.</th>
              <th>Class</th>
              <th>Gender</th>
              <th>Date of Birth</th>
              <th>Guardian</th>
              <th>Guardian Phone</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">
          <span>EduNexus — School Management Platform</span>
          <span>Total: ${filteredStudents.length} students</span>
        </div>
      </body>
      </html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const selectedClassInfo = classes.find(c => c.id === formData.classId);
  const showStream = selectedClassInfo?.level === 'SSS';

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-white text-sm font-bold transition-all ${
          toast.type === 'success' ? 'bg-emerald-600' :
          toast.type === 'error' ? 'bg-rose-600' :
          'bg-blue-600'
        }`}>
          {toast.type === 'success' ? <CheckSquare size={18} /> :
           toast.type === 'error' ? <AlertCircle size={18} /> :
           <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Students</h1>
          <p className="text-gray-500">Manage student records and directory.</p>
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
          {filteredStudents.length > 0 && (
            <>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-2xl font-bold text-xs transition-all"
                title="Export as CSV"
              >
                <Download size={16} />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-2xl font-bold text-xs transition-all"
                title="Export & Print PDF"
              >
                <FileText size={16} />
                <span className="hidden sm:inline">Print</span>
              </button>
            </>
          )}
          {(user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.roleType === 'CLASS' || user?.roleType === 'BOTH') && (
            <button 
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 px-3 py-2.5 md:px-6 md:py-3 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
            >
              <Plus size={20} />
              <span>Add Student</span>
            </button>
          )}
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-sm uppercase">
        <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
          </div>
          <select
            value={selectedClassIdFilter}
            onChange={(e) => setSelectedClassIdFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 md:px-6 md:py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-[10px] font-black tracking-widest uppercase appearance-none"
          >
            <option value="">All Classes</option>
            {sortClasses(classes).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 text-xs font-bold tracking-widest border-b border-gray-50">
              <tr>
                <th className="px-3 py-3 md:px-6 md:py-4">Student</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-gray-500 font-mono">Admission #</th>
                <th className="px-3 py-3 md:px-6 md:py-4">Class & Level</th>
                <th className="px-3 py-3 md:px-6 md:py-4">Guardian</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-right">Actions</th>
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
                filteredStudents.map((student) => {
                  const studentClass = classes.find(c => c.id === student.classId);
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-3 md:px-6 md:py-4">
                        <div className="flex items-center gap-3">
                          <ProfileImage url={student.avatarUrl} size="sm" />
                          <div>
                            <div className="font-bold text-gray-900">{student.name}</div>
                            {student.stream !== 'GENERAL' && (
                              <div className="text-[9px] text-blue-500 font-black tracking-widest">{student.stream}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4 text-gray-500 font-mono">{student.admissionNumber}</td>
                      <td className="px-3 py-3 md:px-6 md:py-4">
                        <div className="flex flex-col gap-1">
                          <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-[10px] w-fit">
                            {studentClass?.name || 'Unassigned'}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold ml-1">{studentClass?.level || '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4 text-gray-500">{student.guardianName}</td>
                      <td className="px-3 py-3 md:px-6 md:py-4 text-right">
                        {canManage && user?.teacherType !== 'SUBJECT_TEACHER' && user?.roleType !== 'SUBJECT' ? (
                          <div className="flex justify-end gap-2 text-xs">
                            {user?.teacherType !== 'SUBJECT_TEACHER' && user?.roleType !== 'SUBJECT' && (
                              <button 
                                onClick={() => openModal(student)}
                                className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                                title="Edit Student"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {isAdmin && user?.teacherType !== 'SUBJECT_TEACHER' && user?.roleType !== 'SUBJECT' && (
                              <button 
                                onClick={() => handleDelete(student.id)}
                                className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                                title="Delete Student"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Read Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
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
                      onUploadingChange={setIsImageUploading}
                      folder="students"
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
                        onChange={(e) => setFormData({...formData, classId: e.target.value, stream: 'GENERAL'})}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none appearance-none"
                      >
                        <option value="">Select Class</option>
                        {sortClasses(classes).map(c => <option key={c.id} value={c.id}>{c.level} - {c.name}</option>)}
                      </select>
                    </div>

                    {showStream && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">SSS Stream</label>
                        <select
                          required
                          value={formData.stream}
                          onChange={(e) => setFormData({...formData, stream: e.target.value})}
                          className="w-full px-4 py-3 bg-blue-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none appearance-none font-bold text-blue-600"
                        >
                          {SSS_STREAMS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}

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
                      disabled={isImageUploading}
                      className={`flex-1 py-4 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-blue-100 transition-all ${isImageUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                    >
                      {isImageUploading ? 'Uploading Image...' : (editingId ? 'Save Changes' : 'Create Student')}
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
