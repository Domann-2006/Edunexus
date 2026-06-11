import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api, { resultService, studentService, classService, subjectService, sessionService, teacherService } from '../services/api';
import { Save, Loader2, Trophy, AlertCircle, FileText, Download, Filter, Eye, X, BookOpen, User, MapPin, ShieldCheck, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

const STREAM_ORDER = ['GENERAL', 'SCIENCE', 'COMMERCIAL', 'ARTS'];

const sortAndDeduplicateSubjects = (subjectsList: any[]): any[] => {
  const seen = new Set<string>();
  const unique = subjectsList.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  return unique.sort((a, b) => {
    const streamA = STREAM_ORDER.indexOf((a.stream || 'GENERAL').toUpperCase());
    const streamB = STREAM_ORDER.indexOf((b.stream || 'GENERAL').toUpperCase());
    const streamDiff = (streamA === -1 ? 99 : streamA) - (streamB === -1 ? 99 : streamB);
    if (streamDiff !== 0) return streamDiff;
    return a.name.localeCompare(b.name);
  });
};

export default function Results({ user }: { user: any }) {
  const location = useLocation();
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [teacherProfile, setTeacherProfile] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [studentResults, setStudentResults] = useState<any[]>([]);
  
  const [filters, setFilters] = useState({
    sessionId: '',
    classId: '',
    subjectId: '',
    term: '1st'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<Record<string, { 
    ca1: number; 
    ca2: number; 
    assignment: number; 
    test: number; 
    exam: number;
    status: string;
    teacherRemark: string;
    adminRemark: string;
    id?: string;
  }>>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (filters.classId && filters.sessionId && filters.subjectId) {
      loadResults();
    }
  }, [filters.sessionId, filters.classId, filters.subjectId, filters.term]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [sessRes, classRes, subRes, studRes] = await Promise.all([
        sessionService.list(),
        classService.list(),
        subjectService.list(),
        studentService.list()
      ]);
      
      let fetchedClasses = classRes.data;
      let fetchedSubjects = subRes.data;
      
      if (user?.role === 'TEACHER') {
        const profileRes = await api.get('/v1/teachers', { params: { userId: user.id } });
        if (profileRes.data.length > 0) {
          const profile = profileRes.data[0];
          setTeacherProfile(profile);
          
          if (profile.assignedClassIds?.length > 0) {
            fetchedClasses = fetchedClasses.filter((c: any) => 
              profile.assignedClassIds.includes(c.id) || 
              profile.assignedClassIds.includes(c.name)
            );
          }
          if (profile.assignedSubjectIds?.length > 0) {
            fetchedSubjects = fetchedSubjects.filter((s: any) => 
              profile.assignedSubjectIds.includes(s.id) || 
              profile.assignedSubjectIds.includes(s.name)
            );
          }
        }
      }

      setSessions(sessRes.data);
      setClasses(sortClasses(fetchedClasses));
      setSubjects(sortAndDeduplicateSubjects(fetchedSubjects));
      setAllStudents(studRes.data);
      
      const currentSess = sessRes.data.find((s: any) => s.isCurrent);
      const params = new URLSearchParams(location.search);
      const qClassId = params.get('classId');
      const qSessionId = params.get('sessionId');
      const qSubjectId = params.get('subjectId');
      const qTerm = params.get('term');

      setFilters(f => ({
        ...f,
        sessionId: qSessionId || currentSess?.id || '',
        term: qTerm || currentSess?.activeTerm || '1st',
        classId: qClassId || '',
        subjectId: qSubjectId || '',
      }));
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async () => {
    setLoading(true);
    try {
      const selectedClass = classes.find(c => c.id === filters.classId);
      const selectedSubject = subjects.find(s => s.id === filters.subjectId);
      
      const resRes = await resultService.list({ 
        classId: filters.classId, 
        sessionId: filters.sessionId, 
        subjectId: filters.subjectId,
        term: filters.term
      });
      
      const selectedClassObj = classes.find((c: any) => c.id === filters.classId);
      let classStudents = allStudents.filter((s: any) => 
        s.classId === filters.classId || 
        s.classId === selectedClassObj?.name ||
        s.className === selectedClassObj?.name
      );
      
      if (selectedClass?.level === 'SSS' && selectedSubject?.stream !== 'GENERAL') {
        classStudents = classStudents.filter(s => s.stream === selectedSubject.stream);
      }

      setStudents(classStudents);
      setResults(resRes.data);

      const initialScores: any = {};
      classStudents.forEach((student: any) => {
        const studentId = student.userId || student.id;
        const result = resRes.data.find((r: any) => r.studentId === studentId);
        initialScores[studentId] = {
          id: result?.id,
          ca1: result?.ca1 || 0,
          ca2: result?.ca2 || 0,
          assignment: result?.assignment || 0,
          test: result?.test || 0,
          exam: result?.exam || 0,
          status: result?.status || 'DRAFT',
          teacherRemark: result?.teacherRemark || '',
          adminRemark: result?.adminRemark || ''
        };
      });
      setScores(initialScores);
    } catch (err: any) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (studentId: string, field: string, value: string | number) => {
    let finalValue: any = value;
    if (['ca1', 'ca2', 'assignment', 'test', 'exam'].includes(field)) {
      const max = field === 'exam' ? 60 : 10;
      finalValue = Math.min(Number(value) || 0, max);
    }
    
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: finalValue
      }
    }));
  };

  const handleSaveAll = async (targetStatus?: string) => {
    setSaving(true);
    try {
      const promises = students.map(student => {
        const studentId = student.userId || student.id;
        const s = scores[studentId];
        const existingResult = results.find(r => r.studentId === studentId);
        
        // Skip if teacher tries to update approved result
        if (user.role === 'TEACHER' && existingResult?.status === 'APPROVED') {
          return Promise.resolve();
        }

        const data: any = {
          ...s,
          studentId: studentId,
          classId: filters.classId,
          subjectId: filters.subjectId,
          subjectName: subjects.find(sub => sub.id === filters.subjectId)?.name,
          sessionId: filters.sessionId,
          term: filters.term,
          schoolId: user?.schoolId,
          status: targetStatus || s.status
        };

        if (existingResult) {
          return resultService.update(existingResult.id, data);
        } else {
          return resultService.create(data);
        }
      });
      
      await Promise.all(promises);
      loadResults();
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (resultId: string, status: string, adminRemark?: string) => {
    setSaving(true);
    try {
      await resultService.update(resultId, { status, adminRemark });
      loadResults();
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    if (students.length === 0) return;
    const headers = ['Student Name', 'Admission #', 'CA 1', 'CA 2', 'Exam', 'Total', 'Grade', 'Remark'];
    const rows = students.map(student => {
      const studentId = student.userId || student.id;
      const s = scores[studentId];
      const total = s.ca1 + s.ca2 + s.exam;
      const res = results.find(r => r.studentId === studentId);
      return [
        student.name,
        student.admissionNumber,
        s.ca1,
        s.ca2,
        s.exam,
        res?.total || total,
        res?.grade || '-',
        res?.remark || '-'
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `results_${filters.classId}_${filters.term}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const openReportCard = async (student: any) => {
    setSelectedStudent(student);
    setIsReportModalOpen(true);
    try {
      const res = await resultService.list({
        studentId: student.userId || student.id,
        sessionId: filters.sessionId,
        term: filters.term
      });
      setStudentResults(res.data);
    } catch (err) {
      console.error('Failed to fetch student results:', err);
    }
  };

  const printReport = () => {
    window.print();
  };

  const selectedClass = classes.find(c => c.id === filters.classId);
  const filteredSubjects = subjects.filter(s => {
    if (!selectedClass) return true;
    return s.level === selectedClass.level;
  });

  const getStatusBadge = (status: string) => {
    const colors: any = {
      DRAFT: 'bg-gray-100 text-gray-600',
      SUBMITTED: 'bg-blue-100 text-blue-600',
      APPROVED: 'bg-emerald-100 text-emerald-600',
      REJECTED: 'bg-rose-100 text-rose-600'
    };
    return (
      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${colors[status] || colors.DRAFT}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-20">
      <AnimatePresence>
        {isReportModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
            >
              <div className="p-8 lg:p-12">
                <header className="flex justify-between items-center mb-10 pb-6 border-b border-gray-100 print:hidden">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                      <FileText size={28} className="text-blue-600" />
                      Academic Progress Report
                    </h2>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Official Student Performance Record</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={printReport}
                      className="px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100"
                    >
                      <Download size={18} />
                      Print / Download PDF
                    </button>
                    <button onClick={() => setIsReportModalOpen(false)} className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-2xl transition-all">
                      <X size={24} />
                    </button>
                  </div>
                </header>

                <div id="report-card-printable" className="bg-white text-gray-900 p-4 lg:p-0">
                  {/* School Header */}
                  <div className="flex items-center justify-between gap-8 mb-12 border-b-4 border-gray-900 pb-10">
                    <div className="flex items-center gap-6">
                      {user?.schoolLogo ? (
                        <img src={user.schoolLogo} alt="School Logo" className="w-24 h-24 object-contain rounded-2xl shadow-xl shadow-blue-50" />
                      ) : (
                        <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-blue-100 transform rotate-3">
                          <BookOpen size={48} />
                        </div>
                      )}
                      <div className="space-y-1">
                        <h1 className="text-4xl font-black tracking-tighter text-gray-900 italic uppercase">
                          {user?.schoolName || 'EduNexus Academy'}
                        </h1>
                        <p className="text-base font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <MapPin size={16} />
                          {user?.schoolAddress || 'School Address Not Configured'}
                        </p>
                        <p className="text-xs font-mono font-bold text-blue-600">
                          TEL: {user?.schoolPhone || '+234 800 000 000'} • EMAIL: education@edunexus.com
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em] mb-2 leading-none">Motto</div>
                        <div className="text-xl font-black italic text-gray-900 leading-none">Excellence in Learning</div>
                    </div>
                  </div>

                  {/* Student Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12 bg-gray-50/50 p-4 md:p-8 rounded-[2rem] border border-gray-100">
                    <div className="flex gap-5">
                      <div className="w-24 h-24 bg-gray-200 rounded-2xl flex items-center justify-center text-gray-400 overflow-hidden ring-4 ring-white shadow-sm shrink-0">
                         {selectedStudent.avatarUrl ? <img src={selectedStudent.avatarUrl} className="w-full h-full object-cover" /> : <User size={40} />}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Student Name</span>
                          <div className="text-lg font-black text-gray-900 uppercase leading-none">{selectedStudent.name}</div>
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Admission No</span>
                          <div className="font-mono font-black text-blue-600 text-sm">{selectedStudent.admissionNumber}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 md:border-l md:pl-10 border-gray-200">
                       <div>
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Class Arm</span>
                          <div className="text-lg font-black text-gray-900 uppercase">
                            {classes.find(c => c.id === selectedStudent.classId)?.name}
                          </div>
                      </div>
                      <div>
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Gender</span>
                          <div className="font-bold text-gray-700 uppercase italic text-sm">{selectedStudent.gender || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="space-y-4 md:border-l md:pl-10 border-gray-200">
                      <div>
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Academic Session</span>
                          <div className="font-black text-gray-900 text-lg uppercase">{sessions.find(s => s.id === filters.sessionId)?.name}</div>
                      </div>
                      <div>
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Evaluation Term</span>
                          <div className="font-black text-blue-600 uppercase italic text-sm">{filters.term} Term</div>
                      </div>
                    </div>
                  </div>

                  {/* Results Table */}
                  <div className="mb-12 rounded-[2rem] border-2 border-gray-900 overflow-hidden shadow-xl shadow-gray-100">
                    <table className="w-full text-left">
                      <thead className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                        <tr>
                          <th className="px-3 py-3 md:px-6 md:py-4">Subject</th>
                          <th className="px-3 py-3 md:px-6 md:py-4 text-center">CA 1 (10)</th>
                          <th className="px-3 py-3 md:px-6 md:py-4 text-center">CA 2 (10)</th>
                          <th className="px-3 py-3 md:px-6 md:py-4 text-center">ASS (10)</th>
                          <th className="px-3 py-3 md:px-6 md:py-4 text-center">TST (10)</th>
                          <th className="px-3 py-3 md:px-6 md:py-4 text-center">EXM (60)</th>
                          <th className="px-3 py-3 md:px-6 md:py-4 text-center">Total</th>
                          <th className="px-3 py-3 md:px-6 md:py-4 text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 uppercase tracking-tight text-sm font-bold">
                        {studentResults.filter(r => r.status === 'APPROVED' || user.role === 'SCHOOL_ADMIN').length > 0 ? 
                          studentResults.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50/50">
                              <td className="px-3 py-3 md:px-6 md:py-4 font-black text-gray-900 italic border-r border-gray-50">{r.subjectName || subjects.find(s => s.id === r.subjectId)?.name || 'Unknown'}</td>
                              <td className="px-3 py-3 md:px-6 md:py-4 text-center text-gray-400 border-r border-gray-50">{r.ca1}</td>
                              <td className="px-3 py-3 md:px-6 md:py-4 text-center text-gray-400 border-r border-gray-50">{r.ca2}</td>
                              <td className="px-3 py-3 md:px-6 md:py-4 text-center text-gray-400 border-r border-gray-50">{r.assignment || 0}</td>
                              <td className="px-3 py-3 md:px-6 md:py-4 text-center text-gray-400 border-r border-gray-50">{r.test || 0}</td>
                              <td className="px-3 py-3 md:px-6 md:py-4 text-center text-gray-400 border-r border-gray-50">{r.exam}</td>
                              <td className="px-3 py-3 md:px-6 md:py-4 text-center font-black text-gray-900 text-lg border-r border-gray-50">{r.total}</td>
                              <td className="px-3 py-3 md:px-6 md:py-4 text-center whitespace-nowrap">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest border-2 ${
                                  r.total >= 70 ? 'bg-emerald-50 border-emerald-500/10 text-emerald-600' :
                                  r.total >= 50 ? 'bg-blue-50 border-blue-500/10 text-blue-600' :
                                  'bg-rose-50 border-rose-500/10 text-rose-600'
                                }`}>
                                  {r.grade}
                                </span>
                              </td>
                            </tr>
                          )) : (
                          <tr>
                            <td colSpan={8} className="px-8 py-16 text-center text-gray-400 lowercase italic">No approved results found.</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-gray-900 text-white border-t-4 border-white">
                        <tr>
                          <td colSpan={6} className="px-3 py-3 md:px-6 md:py-4 font-black uppercase text-[10px] tracking-[0.3em]">Aggregate Analysis</td>
                          <td className="px-3 py-3 md:px-6 md:py-4 text-center font-black text-2xl italic">
                            {studentResults.reduce((acc, r) => acc + r.total, 0)}
                          </td>
                          <td className="px-3 py-3 md:px-6 md:py-4 text-center font-black text-sm italic">
                            Avg: {studentResults.length > 0 ? (studentResults.reduce((acc, r) => acc + r.total, 0) / studentResults.length).toFixed(1) : 0}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Remarks Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16">
                     <div className="bg-blue-50/30 p-4 md:p-8 rounded-[2rem] border border-blue-100 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
                             <Trophy size={14} /> TEACHER'S ASSESSMENT
                          </h4>
                          <p className="text-sm font-bold text-gray-700 italic leading-relaxed">
                            {studentResults.find(r => r.teacherRemark)?.teacherRemark || "Academic performance is consistent. Keep aiming higher for maximum results."}
                          </p>
                        </div>
                        <div className="mt-8 pt-8 border-t border-blue-100 flex items-center justify-between">
                           <div className="h-10 w-32 border-b border-gray-300 italic text-gray-400 text-xs flex items-center">Signature Stamp</div>
                           <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date: {new Date().toLocaleDateString()}</div>
                        </div>
                     </div>

                     <div className="bg-emerald-50/30 p-4 md:p-8 rounded-[2rem] border border-emerald-100 flex flex-col justify-between">
                        <div>
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                              <ShieldCheck size={14} /> PRINCIPAL'S COMMENT
                           </h4>
                           <p className="text-sm font-bold text-gray-700 italic leading-relaxed">
                              {studentResults.find(r => r.adminRemark)?.adminRemark || "An impressive result. The school management congratulates the student on this milestones."}
                           </p>
                        </div>
                        <div className="mt-8 pt-8 border-t border-emerald-100 flex items-center justify-between">
                           <div className="w-24 h-24 bg-white/50 rounded-full border-4 border-dashed border-emerald-200 flex items-center justify-center text-[8px] font-black text-emerald-300 uppercase tracking-tighter text-center">
                              OFFICIAL SEAL
                           </div>
                           <div className="h-10 w-32 border-b border-gray-300"></div>
                        </div>
                     </div>
                  </div>

                  <div className="text-center">
                    <p className="text-[8px] font-black uppercase tracking-[0.8em] text-gray-200">Generated by EduNexus SaaS Platform</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
             {user.role === 'SCHOOL_ADMIN' ? 'Evaluation Monitor' : 'Result Upload Portal'}
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">
             {user.role === 'SCHOOL_ADMIN' 
               ? 'Review and approve academic scores submitted by teachers.' 
               : 'Upload student scores for assigned subjects and submit for review.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportCSV}
            disabled={students.length === 0}
            className="flex items-center gap-2 px-6 py-4 bg-white border border-gray-100 text-gray-900 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
          >
            <Download size={18} />
            <span>Aggregate CSV</span>
          </button>
          
          {user.role === 'TEACHER' && (
            <button 
              onClick={() => handleSaveAll('SUBMITTED')}
              disabled={saving || students.length === 0}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              <span>Submit for Review</span>
            </button>
          )}

          {user.role === 'SCHOOL_ADMIN' && (
            <button 
              onClick={() => handleSaveAll('APPROVED')}
              disabled={saving || students.length === 0}
              className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckSquare size={18} />}
              <span>Bulk Approve</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">Yearly Session</label>
          <select 
            value={filters.sessionId}
            onChange={(e) => setFilters(f => ({ ...f, sessionId: e.target.value }))}
            className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold appearance-none hover:bg-gray-100/50 transition-colors"
          >
            <option value="">Select Session</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isCurrent ? '(Current)' : ''}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">Current Term</label>
          <select 
            value={filters.term}
            onChange={(e) => setFilters(f => ({ ...f, term: e.target.value }))}
            className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold appearance-none hover:bg-gray-100/50 transition-colors"
          >
            <option value="1st">1st Term</option>
            <option value="2nd">2nd Term</option>
            <option value="3rd">3rd Term</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">Academic Level</label>
          <select 
            value={filters.classId}
            onChange={(e) => setFilters(f => ({ ...f, classId: e.target.value, subjectId: '' }))}
            className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold appearance-none hover:bg-gray-100/50 transition-colors"
          >
            <option value="">Select Class</option>
            {sortClasses(classes).map(c => <option key={c.id} value={c.id}>{c.level} - {c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">Curriculum Subject</label>
          <select 
            value={filters.subjectId}
            disabled={!filters.classId}
            onChange={(e) => setFilters(f => ({ ...f, subjectId: e.target.value }))}
            className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold appearance-none hover:bg-gray-100/50 transition-colors disabled:opacity-50"
          >
            <option value="">Select Subject</option>
            {STREAM_ORDER.map(stream => {
              const group = filteredSubjects.filter(s => (s.stream || 'GENERAL').toUpperCase() === stream);
              if (group.length === 0) return null;
              return (
                <optgroup key={stream} label={stream.charAt(0) + stream.slice(1).toLowerCase()}>
                  {group.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      </div>

      {!filters.classId || !filters.subjectId || !filters.sessionId ? (
        <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-[4rem] border border-dashed border-gray-200">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-gray-300 mb-6 shadow-sm">
            <Filter size={40} />
          </div>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Filter for curriculum data to begin</p>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Trophy size={18} className="text-blue-400" />
              <div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] block leading-none">Evaluation Matrix</span>
                 <span className="text-sm font-black italic tracking-tight">{subjects.find(s => s.id === filters.subjectId)?.name} • {selectedClass?.name}</span>
              </div>
            </div>
            
            {loading && <Loader2 className="animate-spin text-white/20" size={24} />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                <tr>
                  <th className="px-3 py-3 md:px-6 md:py-4">Student Basis</th>
                  <th className="px-3 py-3 md:px-6 md:py-4 text-center">CA 1 (10)</th>
                  <th className="px-3 py-3 md:px-6 md:py-4 text-center">CA 2 (10)</th>
                  <th className="px-3 py-3 md:px-6 md:py-4 text-center">ASS (10)</th>
                  <th className="px-3 py-3 md:px-6 md:py-4 text-center">TST (10)</th>
                  <th className="px-3 py-3 md:px-6 md:py-4 text-center">EXM (60)</th>
                  <th className="px-3 py-3 md:px-6 md:py-4 text-center">TOT</th>
                  <th className="px-3 py-3 md:px-6 md:py-4 text-center">Grade</th>
                  <th className="px-3 py-3 md:px-6 md:py-4 text-center">Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((student) => {
                  const studentId = student.userId || student.id;
                  const s = (scores[studentId] || { ca1: 0, ca2: 0, assignment: 0, test: 0, exam: 0, status: 'DRAFT', id: undefined }) as any;
                  const res = results.find(r => r.studentId === studentId);
                  const total = s.ca1 + s.ca2 + s.assignment + s.test + s.exam;
                  const isLocked = user.role === 'TEACHER' && res?.status === 'APPROVED';
                  
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-3 py-3 md:px-6 md:py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{student.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 uppercase tracking-tighter">
                               {student.admissionNumber} {getStatusBadge(s.status)}
                            </div>
                          </div>
                        </div>
                      </td>
                      {['ca1', 'ca2', 'assignment', 'test', 'exam'].map(field => (
                        <td key={field} className="px-3 py-3 md:px-6 md:py-4 text-center">
                          <input 
                            type="number" 
                            disabled={isLocked || user.role === 'SCHOOL_ADMIN'}
                            value={(s as any)[field]}
                            onChange={(e) => handleScoreChange(studentId, field, e.target.value)}
                            className={`w-14 px-2 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 text-center font-black text-gray-900 outline-none transition-all ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 focus:bg-white'}`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 md:px-6 md:py-4 text-center">
                        <span className="text-lg font-black text-blue-600 italic leading-none">{res?.total || total}</span>
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4 text-center">
                         <span className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest ${
                            (res?.total || total) >= 70 ? 'bg-emerald-50 text-emerald-600' :
                             (res?.total || total) >= 50 ? 'bg-blue-50 text-blue-600' :
                            'bg-rose-50 text-rose-600'
                          }`}>
                            {res?.grade || '-'}
                          </span>
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4">
                         <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                               onClick={() => openReportCard(student)}
                               className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                               title="Full Report Card"
                            >
                               <Eye size={18} />
                            </button>
                            {user.role === 'SCHOOL_ADMIN' && s.id && (
                              <div className="flex gap-1 border-l border-gray-100 pl-1 ml-1">
                                <button
                                  onClick={() => handleStatusUpdate(s.id, 'APPROVED')}
                                  className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                  title="Approve"
                                >
                                  <CheckSquare size={18} />
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(s.id, 'REJECTED')}
                                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  title="Reject"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            )}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
