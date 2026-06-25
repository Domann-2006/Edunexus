import React, { useState, useEffect } from 'react';
import api, { attendanceService, studentService, classService, teacherService } from '../services/api';
import { CheckCircle, XCircle, Clock, AlertCircle, Calendar, Users, Loader2, Save, Search, ChevronLeft, ChevronRight, Eye, History } from 'lucide-react';
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

export default function Attendance({ user }: { user: any }) {
  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState(user?.role === 'SCHOOL_ADMIN' ? 'overview' : 'take');

  // Existing "Take Attendance" States
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // New States for "Today's Overview" & "History"
  const [dailySummary, setDailySummary] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({ submitted: 0, total: 0 });
  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyDate, setHistoryDate] = useState('');
  const [historyClassId, setHistoryClassId] = useState('');
  const [drillDownClass, setDrillDownClass] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Initial load
  useEffect(() => {
    fetchClasses();
  }, []);

  // Standard Take Attendance trigger
  useEffect(() => {
    if (selectedClassId && activeTab === 'take') {
      fetchStudentsAndAttendance();
    }
  }, [selectedClassId, date, activeTab]);

  // Today's Overview Trigger
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchDailySummary();
    }
  }, [activeTab, summaryDate]);

  // History trigger
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, historyDate, historyClassId]);

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

      setClasses(sortClasses(fetchedClasses));
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
      
      setAttendance(attMap);
    } catch (err) {
      console.error('Failed to fetch attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailySummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get(`/v1/attendance/daily-summary?date=${summaryDate}`);
      setDailySummary(res.data.summary || []);
      setSummaryStats({
        submitted: res.data.submitted || 0,
        total: res.data.total || 0
      });
    } catch (err) {
      console.error('Failed to fetch daily summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const params: any = {};
      if (historyDate) params.date = historyDate;
      if (historyClassId) params.classId = historyClassId;
      const res = await api.get('/v1/attendance/history', { params });
      setHistoryRecords(res.data.records || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
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

  // Compute daily summary cumulative stats
  const summaryTotalStats = dailySummary.reduce(
    (acc, item) => {
      acc.total += item.total || 0;
      acc.present += item.present || 0;
      acc.absent += item.absent || 0;
      acc.late += item.late || 0;
      acc.excused += item.excused || 0;
      return acc;
    },
    { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Attendance</h1>
          <p className="text-gray-500">Track and monitor student presence and punctuality.</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 max-w-md">
        {user?.role !== 'SCHOOL_ADMIN' && (
          <button
            onClick={() => {
              setActiveTab('take');
              setDrillDownClass(null);
            }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'take' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Take Attendance
          </button>
        )}
        {user?.role === 'SCHOOL_ADMIN' && (
          <button
            onClick={() => {
              setActiveTab('overview');
              setDrillDownClass(null);
            }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'overview' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Today's Overview
          </button>
        )}
        <button
          onClick={() => {
            setActiveTab('history');
            setDrillDownClass(null);
          }}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          History
        </button>
      </div>

      {/* TAB 1 — Take Attendance */}
      {activeTab === 'take' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
              <Calendar size={18} className="text-blue-600" />
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm font-bold text-gray-700 outline-none border-none p-0 focus:ring-0 bg-transparent"
              />
            </div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-5 py-2.5 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            >
              {sortClasses(classes).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {user.role === 'TEACHER' && (
              <button 
                onClick={handleSave}
                disabled={saving || students.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs disabled:opacity-50 ml-auto"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                <span>Save Records</span>
              </button>
            )}
            {user.role === 'SCHOOL_ADMIN' && (
              <div className="px-5 py-2.5 bg-gray-50 text-gray-400 font-bold text-[10px] uppercase tracking-widest rounded-2xl border border-gray-100 ml-auto">
                Monitoring Mode
              </div>
            )}
          </div>

          {/* Stats Grid */}
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

          {/* Student List Table */}
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
      )}

      {/* TAB 2 — Today's Overview (admins only) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {drillDownClass ? (
            <div className="space-y-6">
              {/* Back Button and Info Header */}
              <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <button
                  onClick={() => setDrillDownClass(null)}
                  className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-all uppercase tracking-wider"
                >
                  <ChevronLeft size={18} />
                  Back to Summary
                </button>
                <div className="text-sm font-bold text-gray-900">
                  Class: {drillDownClass.className} ({summaryDate})
                </div>
              </div>

              {/* Read-only student list table */}
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
                            Loading Records...
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
                                  <div
                                    key={btn.id}
                                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 cursor-default ${
                                      attendance[student.id] === btn.id
                                        ? `bg-${btn.color}-50 border-${btn.color}-200 text-${btn.color}-600 scale-110 shadow-sm`
                                        : 'bg-white border-transparent text-gray-200'
                                    }`}
                                  >
                                    <btn.icon size={18} />
                                    <span className="text-[8px] font-black">{btn.label}</span>
                                  </div>
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
          ) : (
            <div className="space-y-6">
              {/* Summary Filter */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                  <Calendar size={18} className="text-blue-600" />
                  <input 
                    type="date" 
                    value={summaryDate}
                    onChange={(e) => setSummaryDate(e.target.value)}
                    className="text-sm font-bold text-gray-700 outline-none border-none p-0 focus:ring-0 bg-transparent"
                  />
                </div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Submitted: <span className="text-blue-600 font-black">{summaryStats.submitted}</span> / {summaryStats.total} Classes
                </div>
              </div>

              {/* Overview Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Tracked Students', value: summaryTotalStats.total, color: 'blue', icon: Users },
                  { label: 'Present Today', value: summaryTotalStats.present, color: 'emerald', icon: CheckCircle },
                  { label: 'Absent Today', value: summaryTotalStats.absent, color: 'rose', icon: XCircle },
                  { label: 'Late Today', value: summaryTotalStats.late, color: 'amber', icon: Clock },
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

              {/* Classes Table */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto text-sm uppercase">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50 text-gray-400 text-xs font-bold tracking-widest border-b border-gray-50">
                      <tr>
                        <th className="px-6 py-4">Class</th>
                        <th className="px-6 py-4">Class Teacher</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Breakdown (P/A/L/E)</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 uppercase tracking-tight">
                      {loadingSummary ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                            <Loader2 className="animate-spin inline mr-2 text-blue-600" size={20} />
                            Loading Class Summary...
                          </td>
                        </tr>
                      ) : dailySummary.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400 lowercase italic">
                            No classes found.
                          </td>
                        </tr>
                      ) : (
                        dailySummary.map((item) => (
                          <tr key={item.classId} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-gray-900">
                              {item.className}
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              {item.teacherName}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {item.submitted ? (
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black tracking-wider">
                                  SUBMITTED
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black tracking-wider">
                                  PENDING
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {item.submitted ? (
                                <span className="font-mono text-xs">
                                  <span className="text-emerald-600 font-bold">{item.present}P</span> /{' '}
                                  <span className="text-rose-600 font-bold">{item.absent}A</span> /{' '}
                                  <span className="text-amber-600 font-bold">{item.late}L</span> /{' '}
                                  <span className="text-blue-600 font-bold">{item.excused}E</span>
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={async () => {
                                  setDrillDownClass(item);
                                  setLoading(true);
                                  try {
                                    const [studentRes, attRes] = await Promise.all([
                                      studentService.list({ classId: item.classId }),
                                      attendanceService.list({ classId: item.classId, date: summaryDate })
                                    ]);
                                    setStudents(studentRes.data);
                                    const attMap: Record<string, string> = {};
                                    attRes.data.forEach((a: any) => {
                                      attMap[a.studentId] = a.status;
                                    });
                                    setAttendance(attMap);
                                  } catch (err) {
                                    console.error(err);
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all inline-flex items-center gap-1 text-[10px] font-black tracking-wider"
                              >
                                <Eye size={14} />
                                <span>VIEW</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3 — History */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* History Filters */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
              <Calendar size={18} className="text-blue-600" />
              <input 
                type="date" 
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="text-sm font-bold text-gray-700 outline-none border-none p-0 focus:ring-0 bg-transparent"
                placeholder="All Dates"
              />
            </div>
            <select
              value={historyClassId}
              onChange={(e) => setHistoryClassId(e.target.value)}
              className="px-5 py-2.5 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            >
              <option value="">All Classes</option>
              {sortClasses(classes).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <button
              onClick={() => {
                setHistoryDate('');
                setHistoryClassId('');
              }}
              className="px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-gray-100 transition-all ml-auto"
            >
              Clear Filters
            </button>
          </div>

          {/* History Records Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto text-sm uppercase">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 text-gray-400 text-xs font-bold tracking-widest border-b border-gray-50">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Class</th>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Admission #</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 uppercase tracking-tight">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        <Loader2 className="animate-spin inline mr-2 text-blue-600" size={20} />
                        Loading History Records...
                      </td>
                    </tr>
                  ) : historyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 lowercase italic">
                        No history records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    historyRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                          {record.date}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {record.className}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {record.studentName}
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                          {record.admissionNumber}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {record.status === 'PRESENT' && (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black tracking-wider">
                              PRESENT
                            </span>
                          )}
                          {record.status === 'ABSENT' && (
                            <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black tracking-wider">
                              ABSENT
                            </span>
                          )}
                          {record.status === 'LATE' && (
                            <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black tracking-wider">
                              LATE
                            </span>
                          )}
                          {record.status === 'EXCUSED' && (
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black tracking-wider">
                              EXCUSED
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
