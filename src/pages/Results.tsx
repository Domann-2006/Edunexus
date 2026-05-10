import React, { useState, useEffect } from 'react';
import api, { resultService, studentService, classService, subjectService, sessionService, teacherService } from '../services/api';
import { Save, Loader2, Trophy, AlertCircle, FileText, Download, Filter, Eye, X, BookOpen, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Results({ user }: { user: any }) {
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
  const [scores, setScores] = useState<Record<string, { ca1: number; ca2: number; exam: number }>>({});

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
            fetchedClasses = fetchedClasses.filter((c: any) => profile.assignedClassIds.includes(c.id));
          }
          if (profile.assignedSubjectIds?.length > 0) {
            fetchedSubjects = fetchedSubjects.filter((s: any) => profile.assignedSubjectIds.includes(s.id));
          }
        }
      }

      setSessions(sessRes.data);
      setClasses(fetchedClasses);
      setSubjects(fetchedSubjects);
      setAllStudents(studRes.data);
      
      const currentSess = sessRes.data.find((s: any) => s.isCurrent);
      if (currentSess) setFilters(f => ({ ...f, sessionId: currentSess.id }));
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
      
      // Filter students who should take this subject
      let classStudents = allStudents.filter((s: any) => s.classId === filters.classId);
      
      // If SSS, filter by stream compatibility
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
          ca1: result?.ca1 || 0,
          ca2: result?.ca2 || 0,
          exam: result?.exam || 0
        };
      });
      setScores(initialScores);
    } catch (err: any) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (studentId: string, field: string, value: string) => {
    const numValue = Math.min(Number(value) || 0, field === 'exam' ? 60 : 20);
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: numValue
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = students.map(student => {
        const studentId = student.userId || student.id;
        const studentScores = scores[studentId];
        const existingResult = results.find(r => r.studentId === studentId);
        
        const schoolId = student.schoolId || user?.schoolId || null;

        const data = {
          ...studentScores,
          studentId: studentId,
          classId: filters.classId,
          subjectId: filters.subjectId,
          sessionId: filters.sessionId,
          term: filters.term,
          schoolId: schoolId,
        };
        
        if (existingResult) {
          return resultService.update(existingResult.id, data);
        } else {
          return resultService.create(data);
        }
      });
      
      await Promise.all(promises);
      alert('Scores saved successfully');
      loadResults();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save scores';
      alert(`Error: ${msg}`);
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
            >
              <div className="print:p-0 p-8">
                <header className="flex justify-between items-center mb-8 pb-6 border-b border-gray-100 print:hidden">
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight uppercase italic flex items-center gap-3">
                    <FileText size={24} className="text-blue-600" />
                    Student Progress Report
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={printReport}
                      className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
                    >
                      <Download size={18} />
                      Export / Print
                    </button>
                    <button onClick={() => setIsReportModalOpen(false)} className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
                      <X size={24} />
                    </button>
                  </div>
                </header>

                <div id="report-card-content" className="space-y-8 bg-white text-gray-900 font-sans tracking-tight">
                  <div className="text-center space-y-2 mb-10">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-white mb-4 transform rotate-3 shadow-xl">
                      <BookOpen size={40} />
                    </div>
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase">EduNexus School Management</h1>
                    <p className="text-[10px] font-black tracking-[0.4em] text-gray-400 uppercase">Knowledge • Excellence • Leadership</p>
                  </div>

                  <div className="grid grid-cols-2 gap-8 py-8 border-y-4 border-gray-900">
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Student Name</span>
                        <div className="text-xl font-bold text-gray-900 uppercase">{selectedStudent.name}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Admission Number</span>
                        <div className="font-mono font-bold text-blue-600">{selectedStudent.admissionNumber}</div>
                      </div>
                    </div>
                    <div className="space-y-4 text-right">
                      <div>
                        <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Academic Level</span>
                        <div className="text-xl font-bold text-gray-900 uppercase">
                          {classes.find(c => c.id === selectedStudent.classId)?.level} - {classes.find(c => c.id === selectedStudent.classId)?.name}
                        </div>
                      </div>
                      <div className="flex justify-end gap-6">
                        <div>
                          <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Session</span>
                          <div className="font-bold text-gray-900">{sessions.find(s => s.id === filters.sessionId)?.name}</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Term</span>
                          <div className="font-bold text-gray-900 italic">{filters.term} Term</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Results Table */}
                  <div className="mt-8 border-2 border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50/80 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <tr>
                          <th className="px-6 py-4">Subject</th>
                          <th className="px-4 py-4 text-center">CA 1 (20)</th>
                          <th className="px-4 py-4 text-center">CA 2 (20)</th>
                          <th className="px-4 py-4 text-center">Exam (60)</th>
                          <th className="px-4 py-4 text-center">Total (100)</th>
                          <th className="px-6 py-4 text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 uppercase tracking-tight text-sm">
                        {studentResults.length > 0 ? studentResults.map(r => {
                          const subjectData = subjects.find(s => s.id === r.subjectId);
                          return (
                            <tr key={r.id}>
                              <td className="px-6 py-4 font-bold text-gray-900">{subjectData?.name || 'Unknown'}</td>
                              <td className="px-4 py-4 text-center text-gray-500">{r.ca1}</td>
                              <td className="px-4 py-4 text-center text-gray-500">{r.ca2}</td>
                              <td className="px-4 py-4 text-center text-gray-500">{r.exam}</td>
                              <td className="px-4 py-4 text-center font-black text-gray-900">{r.total}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${
                                  r.grade === 'A1' ? 'bg-emerald-50 text-emerald-600' :
                                  r.grade.startsWith('B') ? 'bg-blue-50 text-blue-600' :
                                  r.grade.startsWith('C') ? 'bg-amber-50 text-amber-600' :
                                  'bg-red-50 text-red-600'
                                }`}>
                                  {r.grade}
                                </span>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 lowercase italic">No results recorded for this term yet.</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-gray-50/50 border-t-2 border-gray-100">
                        <tr>
                          <td colSpan={4} className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-gray-400">Grand Summary</td>
                          <td className="px-4 py-4 text-center font-black text-xl text-blue-600">
                            {studentResults.reduce((acc, r) => acc + r.total, 0)}
                          </td>
                          <td className="px-6 py-4 text-center font-black text-xs text-gray-400">
                            Avg: {studentResults.length > 0 ? (studentResults.reduce((acc, r) => acc + r.total, 0) / studentResults.length).toFixed(1) : 0}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 gap-12 pt-16">
                    <div className="border-t-2 border-dashed border-gray-200 pt-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8">Class Teacher's Remark & Signature</div>
                      <div className="h-0.5 bg-gray-50 w-full mb-1"></div>
                    </div>
                    <div className="border-t-2 border-dashed border-gray-200 pt-4 text-right">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8">Principal's Signature & School Seal</div>
                      <div className="h-0.5 bg-gray-50 w-full mb-1"></div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Academic Results</h1>
          <p className="text-gray-500 mt-1">Record scores following the new academic hierarchy.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportCSV}
            disabled={students.length === 0}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-100 text-gray-700 font-bold uppercase tracking-widest text-[10px] rounded-2xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
          >
            <Download size={18} />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || students.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            <span>Save Results</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-white border border-gray-100 rounded-3xl shadow-sm">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Session</label>
          <select 
            value={filters.sessionId}
            onChange={(e) => setFilters(f => ({ ...f, sessionId: e.target.value }))}
            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm font-bold appearance-none"
          >
            <option value="">Select Session</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isCurrent ? '(Current)' : ''}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Term</label>
          <select 
            value={filters.term}
            onChange={(e) => setFilters(f => ({ ...f, term: e.target.value }))}
            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm font-bold appearance-none"
          >
            <option value="1st">1st Term</option>
            <option value="2nd">2nd Term</option>
            <option value="3rd">3rd Term</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Class</label>
          <select 
            value={filters.classId}
            onChange={(e) => setFilters(f => ({ ...f, classId: e.target.value, subjectId: '' }))}
            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm font-bold appearance-none"
          >
            <option value="">Select Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.level} - {c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Subject</label>
          <select 
            value={filters.subjectId}
            disabled={!filters.classId}
            onChange={(e) => setFilters(f => ({ ...f, subjectId: e.target.value }))}
            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm font-bold appearance-none disabled:opacity-50"
          >
            <option value="">Select Subject</option>
            {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.stream})</option>)}
          </select>
        </div>
      </div>

      {!filters.classId || !filters.subjectId || !filters.sessionId ? (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-gray-300 mb-4 shadow-sm">
            <Filter size={32} />
          </div>
          <p className="text-gray-400 font-medium">Select class, session, and subject to begin recording scores.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-blue-50/50 border-b border-blue-50 flex items-center gap-2 text-blue-700">
             <Trophy size={16} />
             <span className="text-[10px] font-black uppercase tracking-widest">Recording for: {subjects.find(s => s.id === filters.subjectId)?.name}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/80 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
                <tr>
                  <th className="px-8 py-5">Student</th>
                  <th className="px-8 py-5">Adm #</th>
                  <th className="px-8 py-5 text-center">CA 1 (20)</th>
                  <th className="px-8 py-5 text-center">CA 2 (20)</th>
                  <th className="px-8 py-5 text-center">Exam (60)</th>
                  <th className="px-8 py-5 text-center">Total</th>
                  <th className="px-8 py-5 text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <Loader2 className="animate-spin inline text-blue-600 mb-2" size={32} />
                      <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">Fetching students...</div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <AlertCircle className="inline text-amber-400 mb-2" size={32} />
                      <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">No students assigned to this class/stream for this subject.</div>
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const studentId = student.userId || student.id;
                    const s = scores[studentId] || { ca1: 0, ca2: 0, exam: 0 };
                    const res = results.find(r => r.studentId === studentId);
                    const total = s.ca1 + s.ca2 + s.exam;
                    
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <div className="font-bold text-gray-900">{student.name}</div>
                              {student.stream !== 'GENERAL' && (
                                <div className="text-[9px] text-blue-500 font-black tracking-widest uppercase">{student.stream}</div>
                              )}
                            </div>
                            <button 
                              onClick={() => openReportCard(student)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="View Full Report Card"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-xs font-mono text-gray-400">{student.admissionNumber}</td>
                        <td className="px-8 py-6 text-center">
                          <input 
                            type="number" 
                            max={20}
                            value={s.ca1}
                            onChange={(e) => handleScoreChange(studentId, 'ca1', e.target.value)}
                            className="w-16 px-3 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-center font-bold text-gray-900 outline-none"
                          />
                        </td>
                        <td className="px-8 py-6 text-center">
                          <input 
                            type="number" 
                            max={20}
                            value={s.ca2}
                            onChange={(e) => handleScoreChange(studentId, 'ca2', e.target.value)}
                            className="w-16 px-3 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-center font-bold text-gray-900 outline-none"
                          />
                        </td>
                        <td className="px-8 py-6 text-center">
                          <input 
                            type="number" 
                            max={60}
                            value={s.exam}
                            onChange={(e) => handleScoreChange(studentId, 'exam', e.target.value)}
                            className="w-16 px-3 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-center font-bold text-gray-900 outline-none"
                          />
                        </td>
                        <td className="px-8 py-6 text-center font-bold text-gray-900">
                          {res?.total || total}
                        </td>
                        <td className="px-8 py-6 text-center">
                          {res?.grade ? (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${
                              res.grade === 'A1' ? 'bg-emerald-50 text-emerald-600' :
                              res.grade.startsWith('B') ? 'bg-blue-50 text-blue-600' :
                              res.grade.startsWith('C') ? 'bg-amber-50 text-amber-600' :
                              'bg-red-50 text-red-600'
                            }`}>
                              {res.grade}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
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
      )}
    </div>
  );
}
