import React, { useState, useEffect } from 'react';
import { activityService, schoolService, attendanceService, resultService, studentService, classService, subjectService } from '../services/api';
import { Shield, Clock, User, Info, Search, Filter, Loader2, Calendar, CheckSquare, FileSpreadsheet, Play, Activity, Building, Award, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProfileImage from '../components/ProfileImage';

type Tab = 'activity' | 'attendance' | 'results';

export default function ActivityLogs({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [logs, setLogs] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, any>>({});
  const [classesMap, setClassesMap] = useState<Record<string, any>>({});
  const [subjectsMap, setSubjectsMap] = useState<Record<string, any>>({});
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(''); // last-7-days, today, etc.
  
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  useEffect(() => {
    fetchData();
    if (user?.role === 'SUPER_ADMIN') {
      schoolService.list().then(res => setSchools(res.data));
    }
  }, [selectedSchoolId, activeTab, roleFilter, actionFilter, dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const schoolId = selectedSchoolId || user?.schoolId;
      
      if (activeTab === 'activity') {
        const res = await activityService.list({ 
          schoolId,
          search: search || undefined,
          roleFilter: roleFilter || undefined,
          actionFilter: actionFilter || undefined,
          sort: 'createdAt:desc' 
        });
        setLogs(res.data);
      } else if (activeTab === 'attendance') {
        const [attRes, studentRes, classRes] = await Promise.all([
          attendanceService.list({ schoolId, limit: 100 }),
          studentService.list({ schoolId }),
          classService.list({ schoolId })
        ]);
        setAttendance(attRes.data);
        
        const sMap: any = {};
        studentRes.data.forEach((s: any) => sMap[s.id] = s);
        setStudentsMap(sMap);
        
        const cMap: any = {};
        classRes.data.forEach((c: any) => cMap[c.id] = c);
        setClassesMap(cMap);
      } else if (activeTab === 'results') {
        const [resRes, studentRes, classRes, subRes] = await Promise.all([
          resultService.list({ schoolId, limit: 100 }),
          studentService.list({ schoolId }),
          classService.list({ schoolId }),
          subjectService.list({ schoolId })
        ]);
        setResults(resRes.data);
        
        const sMap: any = {};
        studentRes.data.forEach((s: any) => sMap[s.id] = s);
        setStudentsMap(sMap);

        const cMap: any = {};
        classRes.data.forEach((c: any) => cMap[c.id] = c);
        setClassesMap(cMap);

        const subMap: any = {};
        subRes.data.forEach((s: any) => subMap[s.id] = s);
        setSubjectsMap(subMap);
      }
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Local/server merged filtering to guarantee instant responsive search feedback
  const filteredLogs = logs.filter(log => {
    // Local text filter
    const matchesText = !search || 
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.userName?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase()) ||
      log.schoolName?.toLowerCase().includes(search.toLowerCase());

    // Local role filter
    const matchesRole = !roleFilter || log.role === roleFilter;

    // Local action filter
    const matchesAction = !actionFilter || log.action === actionFilter;

    // Local date filter
    let matchesDate = true;
    if (dateFilter) {
      const now = new Date();
      const logDate = new Date(log.createdAt);
      if (dateFilter === 'today') {
        matchesDate = now.toDateString() === logDate.toDateString();
      } else if (dateFilter === 'week') {
        const diff = now.getTime() - logDate.getTime();
        matchesDate = diff <= 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === 'month') {
        const diff = now.getTime() - logDate.getTime();
        matchesDate = diff <= 30 * 24 * 60 * 60 * 1000;
      }
    }

    return matchesText && matchesRole && matchesAction && matchesDate;
  });

  const filteredAttendance = attendance.filter(a => {
    const student = studentsMap[a.studentId];
    const className = classesMap[a.classId]?.name;
    return !search || 
           student?.name?.toLowerCase().includes(search.toLowerCase()) || 
           className?.toLowerCase().includes(search.toLowerCase()) ||
           a.status?.toLowerCase().includes(search.toLowerCase());
  });

  const filteredResults = results.filter(r => {
    const student = studentsMap[r.studentId];
    const className = classesMap[r.classId]?.name;
    const subjectName = subjectsMap[r.subjectId]?.name;
    return !search ||
           student?.name?.toLowerCase().includes(search.toLowerCase()) || 
           className?.toLowerCase().includes(search.toLowerCase()) ||
           subjectName?.toLowerCase().includes(search.toLowerCase());
  });

  // Unique actions in current logs for filters
  const actionTypes = Array.from(new Set(logs.map(l => l.action).filter(Boolean)));

  const getActionColor = (action: string) => {
    if (!action) return 'bg-gray-100 text-gray-700 border-gray-200';
    if (action.includes('LOGIN')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (action.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (action.includes('UPDATE')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (action.includes('DELETE')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-violet-50 text-violet-700 border-violet-200';
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Activity className="text-blue-600 animate-pulse" size={32} />
            Audit & System Logs
          </h1>
          <p className="text-gray-500 font-bold mt-1 uppercase tracking-widest text-[10px]">
            {user?.role === 'SUPER_ADMIN' 
              ? 'Real-time administrative timeline and School Admin audit tracking.'
              : 'School audit engine monitoring personnel shifts, operational actions, and grade submissions.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
           {user?.role === 'SUPER_ADMIN' && (
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="px-6 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-xs font-bold text-gray-700 outline-none hover:border-blue-300 focus:border-blue-500 transition-colors"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button 
            onClick={fetchData}
            className="px-6 py-3 bg-gray-900 text-white font-bold rounded-2xl shadow-lg hover:bg-black transition-all uppercase tracking-widest text-xs"
          >
            Refresh Data
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-[1.5rem] border border-gray-100 w-fit shadow-sm">
        {[
          { id: 'activity', label: 'System Audit Logs', icon: Shield },
          ...(user?.role !== 'SUPER_ADMIN' ? [
            { id: 'attendance', label: 'Attendance Monitor', icon: CheckSquare },
            { id: 'results', label: 'Grade Audits', icon: FileSpreadsheet },
          ] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as Tab);
              setSearch('');
              setRoleFilter('');
              setActionFilter('');
              setDateFilter('');
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 ring-4 ring-blue-500/10' 
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden text-sm">
        {/* Advanced Filters Bar */}
        <div className="p-6 border-b border-gray-50 bg-gray-50/20 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-2.5 flex items-center gap-3 shadow-inner">
              <Search className="text-gray-400 shrink-0 ml-2" size={18} />
              <input
                type="text"
                placeholder={`Search ${activeTab === 'activity' ? 'audit timeline logs' : activeTab === 'attendance' ? 'student attendance' : 'result grades'}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 border-0 bg-transparent focus:ring-0 outline-none p-2 font-bold text-gray-900 text-xs placeholder:text-gray-400"
              />
            </div>

            {activeTab === 'activity' && (
              <div className="flex flex-wrap gap-3">
                {/* Role filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-500 outline-none focus:border-blue-500"
                >
                  <option value="">All Roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="SCHOOL_ADMIN">School Admin</option>
                  {user?.role !== 'SUPER_ADMIN' && <option value="TEACHER">Teacher</option>}
                </select>

                {/* Action Filter */}
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-500 outline-none focus:border-blue-500 max-w-[180px]"
                >
                  <option value="">All Actions</option>
                  {actionTypes.map(act => (
                    <option key={act} value={act}>{act.replace(/_/g, ' ')}</option>
                  ))}
                </select>

                {/* Date Filter */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-500 outline-none focus:border-blue-500"
                >
                  <option value="">Any Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 md:p-8"
            >
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  {loading ? (
                    <div className="py-20 text-center text-gray-400">
                      <Loader2 className="animate-spin inline mr-2 text-blue-600" size={32} />
                      <span className="font-bold text-xs uppercase tracking-widest block mt-4">Streaming live activity logs...</span>
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="py-20 text-center max-w-sm mx-auto">
                      <Shield className="mx-auto text-gray-200 mb-4" size={56} />
                      <h3 className="text-xl font-bold text-gray-800">No activities recorded yet</h3>
                      <p className="text-xs text-gray-400 mt-2 font-medium">Any administrative, teaching, or grade audit events will materialize in this feed in real-time.</p>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-dashed border-gray-100 ml-4 md:ml-6 pl-6 md:pl-10 space-y-10">
                      {filteredLogs.map((log, idx) => (
                        <div key={log.id} className="relative group">
                          {/* Circle indicator */}
                          <div className={`absolute -left-[35px] md:-left-[51px] top-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-md transition-transform group-hover:scale-110 ${
                            log.action?.includes('CREATE') ? 'bg-emerald-500' :
                            log.action?.includes('DELETE') ? 'bg-rose-500' :
                            log.action?.includes('UPDATE') ? 'bg-amber-500' : 'bg-blue-500'
                          }`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>

                          {/* Log card */}
                          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 font-bold text-gray-700">
                                  {log.userName?.charAt(0) || 'S'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-gray-900">{log.userName || 'System'}</span>
                                    <span className="text-[9px] px-2 py-0.5 rounded-md font-black bg-gray-100 text-gray-600 tracking-wider">
                                      {log.role?.replace(/_/g, ' ')}
                                    </span>
                                    {log.schoolName && log.schoolId !== 'SUPER' && (
                                      <span className="text-[9px] px-2 py-0.5 rounded-md font-black bg-blue-50 text-blue-600 flex items-center gap-1">
                                        <Building size={10} />
                                        {log.schoolName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                                    <Clock size={12} />
                                    <span className="text-[10px] font-mono font-medium">
                                      {new Date(log.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border ${getActionColor(log.action)}`}>
                                  {log.action?.replace(/_/g, ' ')}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-extrabold text-[8px] flex items-center gap-0.5 border border-emerald-100 uppercase tracking-widest">
                                  <CheckCircle2 size={10} />
                                  {log.status || 'SUCCESS'}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-gray-600 mt-4 leading-relaxed font-semibold">
                              {log.details}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'attendance' && (
                <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-gray-50/10">
                  <table className="w-full text-left">
                    <thead className="bg-[#f8f9fa] border-b border-gray-100 text-[10px] font-black tracking-widest uppercase text-gray-400">
                      <tr>
                        <th className="px-8 py-5">Date</th>
                        <th className="px-8 py-5">Student</th>
                        <th className="px-8 py-5">Class</th>
                        <th className="px-8 py-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {loading ? (
                        <LoadingRow colSpan={4} label="attendance details" />
                      ) : filteredAttendance.length === 0 ? (
                        <EmptyRow colSpan={4} />
                      ) : (
                        filteredAttendance.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50/30 transition-colors">
                            <td className="px-8 py-6">
                              <div className="text-[10px] font-mono font-bold text-gray-500 flex items-center gap-2">
                                <Calendar size={14} className="text-blue-500" />
                                {a.date}
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <ProfileImage url={studentsMap[a.studentId]?.avatarUrl} size="sm" />
                                <span className="font-bold text-gray-900">{studentsMap[a.studentId]?.name || 'Unknown student'}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                {classesMap[a.classId]?.name || 'Unknown Class'}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border ${
                                a.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                a.status === 'ABSENT' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'results' && (
                <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-gray-50/10">
                  <table className="w-full text-left">
                    <thead className="bg-[#f8f9fa] border-b border-gray-100 text-[10px] font-black tracking-widest uppercase text-gray-400">
                      <tr>
                        <th className="px-8 py-5">Student</th>
                        <th className="px-8 py-5">Subject</th>
                        <th className="px-8 py-5">Class</th>
                        <th className="px-8 py-5">Score</th>
                        <th className="px-8 py-5">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {loading ? (
                        <LoadingRow colSpan={5} label="grade audits" />
                      ) : filteredResults.length === 0 ? (
                        <EmptyRow colSpan={5} />
                      ) : (
                        filteredResults.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50/30 transition-colors">
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-3">
                                <ProfileImage url={studentsMap[r.studentId]?.avatarUrl} size="sm" />
                                <span className="font-bold text-gray-900">{studentsMap[r.studentId]?.name || 'Unknown Student'}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="font-bold text-gray-900 tracking-tight italic">
                                {subjectsMap[r.subjectId]?.name || 'Unknown Subject'}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                {classesMap[r.classId]?.name || 'Unknown Class'}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#141416] text-xl tracking-tight">{r.total}</span>
                                <span className="text-[10px] font-mono text-gray-400">/ 100</span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shadow-sm ${
                                r.grade === 'A' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white' :
                                r.grade === 'B' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                                r.grade === 'C' ? 'bg-gradient-to-br from-teal-400 to-teal-500 text-white' :
                                r.grade === 'P' ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' :
                                'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
                              }`}>
                                {r.grade}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function LoadingRow({ colSpan, label }: { colSpan: number, label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-8 py-20 text-center text-gray-400">
        <Loader2 className="animate-spin inline mr-2 text-blue-600" size={24} />
        <span className="font-bold uppercase tracking-[0.2em] text-[10px]">Syncing {label}...</span>
      </td>
    </tr>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-8 py-20 text-center">
        <div className="flex flex-col items-center gap-4 text-gray-400 max-w-sm mx-auto">
          <Info size={40} className="text-gray-200" />
          <div>
            <span className="text-xs font-bold uppercase tracking-widest block text-gray-700">No matching monitor records found</span>
            <span className="text-[10px] text-gray-400 leading-normal block mt-1">Refine your query or check back later once records are registered.</span>
          </div>
        </div>
      </td>
    </tr>
  );
}
