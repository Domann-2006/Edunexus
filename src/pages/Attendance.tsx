import React, { useState, useEffect } from 'react';
import { attendanceService, studentService, classService, teacherService } from '../services/api';
import { CheckCircle, XCircle, Clock, AlertCircle, Calendar, Users, Loader2, Save, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProfileImage from '../components/ProfileImage';

export default function Attendance({ user }: { user: any }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudentsAndAttendance();
    }
  }, [selectedClassId, date]);

  const fetchClasses = async () => {
    try {
      const res = await classService.list({ schoolId: user?.schoolId });
      let fetchedClasses = res.data;

      if (user?.role === 'TEACHER') {
        const profileRes = await teacherService.list({ userId: user.id });
        if (profileRes.data.length > 0) {
          const profile = profileRes.data[0];
          if (profile.assignedClassIds?.length > 0) {
            fetchedClasses = fetchedClasses.filter((c: any) => 
              profile.assignedClassIds.includes(c.id) || 
              profile.assignedClassIds.includes(c.name)
            );
          } else {
            fetchedClasses = [];
          }
        } else {
          fetchedClasses = [];
        }
      }

      setClasses([...fetchedClasses].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })));
      if (fetchedClasses.length > 0) {
        setSelectedClassId(fetchedClasses[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  };

  const fetchStudentsAndAttendance = async () => {
    setLoading(true);
    try {
      const [studentRes, attRes] = await Promise.all([
        studentService.list({ classId: selectedClassId }),
        attendanceService.list({ classId: selectedClassId, date })
      ]);
      setStudents(studentRes.data);
      
      const attMap: Record<string, string> = {};
      attRes.data.forEach((a: any) => {
        attMap[a.studentId] = a.status;
      });
      
      // Default to PRESENT for students without records if needed, 
      // but usually better to have them start fresh or keep empty
      setAttendance(attMap);
    } catch (err) {
      console.error('Failed to fetch attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: string) => {
    if (user.role === 'SCHOOL_ADMIN') return;
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (user.role === 'SCHOOL_ADMIN') return;
    setSaving(true);
    try {
      const records = students.map(student => ({
        studentId: student.id,
        classId: selectedClassId,
        schoolId: user?.schoolId,
        date,
        status: attendance[student.id] || 'PRESENT',
        recordedBy: user?.id,
        createdAt: new Date().toISOString()
      }));
      
      await attendanceService.bulkCreate(records);
      alert('Attendance saved successfully!');
    } catch (err: any) {
      console.error('Failed to save attendance:', err);
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    present: Object.values(attendance).filter(v => v === 'PRESENT').length,
    absent: Object.values(attendance).filter(v => v === 'ABSENT').length,
    late: Object.values(attendance).filter(v => v === 'LATE').length,
    total: students.length
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Attendance</h1>
          <p className="text-gray-500">Track student presence and punctuality.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <Calendar size={18} className="text-blue-600" />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm font-bold text-gray-700 outline-none border-none p-0 focus:ring-0"
            />
          </div>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-5 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
          >
            {[...classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {user.role === 'TEACHER' && (
            <button 
              onClick={handleSave}
              disabled={saving || students.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              <span>Save Records</span>
            </button>
          )}
          {user.role === 'SCHOOL_ADMIN' && (
            <div className="px-5 py-3 bg-gray-50 text-gray-400 font-bold text-[10px] uppercase tracking-widest rounded-2xl border border-gray-100">
              Monitoring Mode
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: stats.total, color: 'blue', icon: Users },
          { label: 'Present', value: stats.present, color: 'emerald', icon: CheckCircle },
          { label: 'Absent', value: stats.absent, color: 'rose', icon: XCircle },
          { label: 'Late', value: stats.late, color: 'amber', icon: Clock },
        ].map((s) => (
          <div key={s.label} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className={`p-2 w-10 h-10 rounded-xl bg-${s.color}-50 text-${s.color}-600 mb-4 flex items-center justify-center`}>
              <s.icon size={20} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm"
            />
          </div>
          {user.role === 'TEACHER' && (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const newAtt = { ...attendance };
                  filteredStudents.forEach(s => newAtt[s.id] = 'PRESENT');
                  setAttendance(newAtt);
                }}
                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-all"
              >
                All Present
              </button>
              <button 
                onClick={() => {
                  const newAtt = { ...attendance };
                  filteredStudents.forEach(s => newAtt[s.id] = 'ABSENT');
                  setAttendance(newAtt);
                }}
                className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-100 transition-all"
              >
                All Absent
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto text-sm uppercase">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 text-xs font-bold tracking-widest border-b border-gray-50">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Admission #</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 uppercase tracking-tight">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                    <Loader2 className="animate-spin inline mr-2 text-blue-600" size={20} />
                    Loading Students...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-400 lowercase italic">
                    No students found in this class.
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
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                      {student.admissionNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-3">
                        {[
                          { id: 'PRESENT', color: 'emerald', label: 'P', icon: CheckCircle },
                          { id: 'ABSENT', color: 'rose', label: 'A', icon: XCircle },
                          { id: 'LATE', color: 'amber', label: 'L', icon: Clock },
                          { id: 'EXCUSED', color: 'blue', label: 'E', icon: AlertCircle },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => handleStatusChange(student.id, btn.id)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all border-2 ${
                              attendance[student.id] === btn.id
                                ? `bg-${btn.color}-50 border-${btn.color}-200 text-${btn.color}-600 scale-110 shadow-sm`
                                : 'bg-white border-transparent text-gray-300 hover:text-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <btn.icon size={18} />
                            <span className="text-[8px] font-black">{btn.label}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
