import React, { useState, useEffect } from 'react';
import { resultService, studentService, classService, subjectService, sessionService } from '../services/api';
import { Save, Loader2, Trophy, AlertCircle, FileText, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Results() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  
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
      loadStudentsAndResults();
    }
  }, [filters]);

  const loadInitialData = async () => {
    try {
      const [sessRes, classRes, subRes] = await Promise.all([
        sessionService.list(),
        classService.list(),
        subjectService.list()
      ]);
      setSessions(sessRes.data);
      setClasses(classRes.data);
      setSubjects(subRes.data);
      
      const currentSess = sessRes.data.find((s: any) => s.isCurrent);
      if (currentSess) setFilters(f => ({ ...f, sessionId: currentSess.id }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentsAndResults = async () => {
    setLoading(true);
    try {
      const [studRes, resRes] = await Promise.all([
        studentService.list(),
        resultService.list({ 
          classId: filters.classId, 
          sessionId: filters.sessionId, 
          subjectId: filters.subjectId,
          term: filters.term
        })
      ]);
      
      const classStudents = studRes.data.filter((s: any) => s.classId === filters.classId);
      setStudents(classStudents);
      setResults(resRes.data);

      const initialScores: any = {};
      classStudents.forEach((student: any) => {
        const result = resRes.data.find((r: any) => r.studentId === student.userId);
        initialScores[student.userId] = {
          ca1: result?.ca1 || 0,
          ca2: result?.ca2 || 0,
          exam: result?.exam || 0
        };
      });
      setScores(initialScores);
    } catch (err) {
      console.error(err);
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
        const studentScores = scores[student.userId];
        const existingResult = results.find(r => r.studentId === student.userId);
        const data = {
          ...studentScores,
          studentId: student.userId,
          classId: filters.classId,
          subjectId: filters.subjectId,
          sessionId: filters.sessionId,
          term: filters.term
        };
        
        if (existingResult) {
          return resultService.update(existingResult.id, data);
        } else {
          return resultService.create(data);
        }
      });
      
      await Promise.all(promises);
      alert('Scores saved successfully');
      loadStudentsAndResults();
    } catch (err) {
      alert('Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    if (students.length === 0) return;
    const headers = ['Student Name', 'Admission #', 'CA 1', 'CA 2', 'Exam', 'Total', 'Grade', 'Remark'];
    const rows = students.map(student => {
      const s = scores[student.userId];
      const total = s.ca1 + s.ca2 + s.exam;
      // In a real app we'd get these from the server calculated result, but for export we can re-calc
      // Or better, use the results array
      const res = results.find(r => r.studentId === student.userId);
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

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Academic Results</h1>
          <p className="text-gray-500 mt-1">Record scores and generate termly performance reports.</p>
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
            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm font-bold"
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
            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm font-bold"
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
            onChange={(e) => setFilters(f => ({ ...f, classId: e.target.value }))}
            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm font-bold"
          >
            <option value="">Select Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Subject</label>
          <select 
            value={filters.subjectId}
            onChange={(e) => setFilters(f => ({ ...f, subjectId: e.target.value }))}
            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm font-bold"
          >
            <option value="">Select Subject</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {!filters.classId || !filters.subjectId || !filters.sessionId ? (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-gray-300 mb-4 shadow-sm">
            <FileText size={32} />
          </div>
          <p className="text-gray-400 font-medium">Select class, session, and subject to begin recording scores.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
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
                      <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">No students assigned to this class.</div>
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const s = scores[student.userId] || { ca1: 0, ca2: 0, exam: 0 };
                    const res = results.find(r => r.studentId === student.userId);
                    const total = s.ca1 + s.ca2 + s.exam;
                    
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-bold text-gray-900">{student.name}</div>
                        </td>
                        <td className="px-8 py-6 text-xs font-mono text-gray-400">{student.admissionNumber}</td>
                        <td className="px-8 py-6 text-center">
                          <input 
                            type="number" 
                            max={20}
                            value={s.ca1}
                            onChange={(e) => handleScoreChange(student.userId, 'ca1', e.target.value)}
                            className="w-16 px-3 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-center font-bold text-gray-900 outline-none"
                          />
                        </td>
                        <td className="px-8 py-6 text-center">
                          <input 
                            type="number" 
                            max={20}
                            value={s.ca2}
                            onChange={(e) => handleScoreChange(student.userId, 'ca2', e.target.value)}
                            className="w-16 px-3 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-center font-bold text-gray-900 outline-none"
                          />
                        </td>
                        <td className="px-8 py-6 text-center">
                          <input 
                            type="number" 
                            max={60}
                            value={s.exam}
                            onChange={(e) => handleScoreChange(student.userId, 'exam', e.target.value)}
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
