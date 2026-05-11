import React, { useState, useEffect } from 'react';
import { activityService, schoolService, attendanceService, resultService, studentService, classService, subjectService } from '../services/api';
import { Shield, Clock, User, Info, Search, Filter, Loader2, Calendar, CheckSquare, FileSpreadsheet } from 'lucide-react';
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
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  useEffect(() => {
    fetchData();
    if (user?.role === 'SUPER_ADMIN') {
      schoolService.list().then(res => setSchools(res.data));
    }
  }, [selectedSchoolId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const schoolId = selectedSchoolId || user?.schoolId;
      
      if (activeTab === 'activity') {
        const res = await activityService.list({ 
          schoolId,
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

  const filteredLogs = logs.filter(log => 
    log.action?.toLowerCase().includes(search.toLowerCase()) ||
    log.userName?.toLowerCase().includes(search.toLowerCase()) ||
    log.details?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAttendance = attendance.filter(a => {
    const student = studentsMap[a.studentId];
    const className = classesMap[a.classId]?.name;
    return student?.name?.toLowerCase().includes(search.toLowerCase()) || 
           className?.toLowerCase().includes(search.toLowerCase()) ||
           a.status?.toLowerCase().includes(search.toLowerCase());
  });

  const filteredResults = results.filter(r => {
    const student = studentsMap[r.studentId];
    const className = classesMap[r.classId]?.name;
    const subjectName = subjectsMap[r.subjectId]?.name;
    return student?.name?.toLowerCase().includes(search.toLowerCase()) || 
           className?.toLowerCase().includes(search.toLowerCase()) ||
           subjectName?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Audit & Monitoring</h1>
          <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Centralized tracking of system activity and teacher performance.</p>
        </div>
        <div className="flex flex-wrap gap-4">
           {user?.role === 'SUPER_ADMIN' && (
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="px-6 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-700 outline-none"
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
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-[1.5rem] border border-gray-100 w-fit">
        {[
          { id: 'activity', label: 'System Logs', icon: Shield },
          { id: 'attendance', label: 'Attendance Monitor', icon: CheckSquare },
          { id: 'results', label: 'Result Audits', icon: FileSpreadsheet },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as Tab);
              setSearch('');
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

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden text-sm">
        <div className="p-6 border-b border-gray-50 flex items-center gap-3 bg-gray-50/30">
          <Search className="text-gray-400" size={18} />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'activity' ? 'logs' : activeTab === 'attendance' ? 'attendance' : 'results'}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 bg-transparent focus:ring-0 outline-none p-2 font-bold text-gray-900"
          />
        </div>

        <div className="overflow-x-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'activity' && (
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black tracking-[0.2em] uppercase border-b border-gray-50">
                    <tr>
                      <th className="px-8 py-5">Timestamp</th>
                      <th className="px-8 py-5">User</th>
                      <th className="px-8 py-5">Action</th>
                      <th className="px-8 py-5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <LoadingRow colSpan={4} label="activity logs" />
                    ) : filteredLogs.length === 0 ? (
                      <EmptyRow colSpan={4} />
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 text-gray-500">
                              <Clock size={14} className="text-blue-400" />
                              <span className="text-[10px] font-mono font-bold">
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{log.userName || 'System'}</span>
                              <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">{log.role}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-2 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest ${
                              log.action?.includes('CREATE') ? 'bg-emerald-50 text-emerald-600' :
                              log.action?.includes('DELETE') ? 'bg-rose-50 text-rose-600' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[10px] text-gray-500 line-clamp-2 max-w-md font-medium">
                              {log.details}
                            </p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'attendance' && (
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black tracking-[0.2em] uppercase border-b border-gray-50">
                    <tr>
                      <th className="px-8 py-5">Date</th>
                      <th className="px-8 py-5">Student</th>
                      <th className="px-8 py-5">Class</th>
                      <th className="px-8 py-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <LoadingRow colSpan={4} label="attendance" />
                    ) : filteredAttendance.length === 0 ? (
                      <EmptyRow colSpan={4} />
                    ) : (
                      filteredAttendance.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-6 whitespace-nowrap">
                            <div className="text-[10px] font-mono font-bold text-gray-500 flex items-center gap-2">
                              <Calendar size={14} className="text-blue-400" />
                              {a.date}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <ProfileImage url={studentsMap[a.studentId]?.avatarUrl} size="sm" />
                              <span className="font-bold text-gray-900">{studentsMap[a.studentId]?.name || 'Unknown Student'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-lg">
                              {classesMap[a.classId]?.name || 'Unknown Class'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-2 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest ${
                              a.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' :
                              a.status === 'ABSENT' ? 'bg-rose-50 text-rose-600' :
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'results' && (
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black tracking-[0.2em] uppercase border-b border-gray-50">
                    <tr>
                      <th className="px-8 py-5">Student</th>
                      <th className="px-8 py-5">Subject</th>
                      <th className="px-8 py-5">Class</th>
                      <th className="px-8 py-5">Score</th>
                      <th className="px-8 py-5">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <LoadingRow colSpan={5} label="results" />
                    ) : filteredResults.length === 0 ? (
                      <EmptyRow colSpan={5} />
                    ) : (
                      filteredResults.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
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
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-lg">
                              {classesMap[r.classId]?.name || 'Unknown Class'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-lg">{r.total}</span>
                              <span className="text-[10px] text-gray-400">/ 100</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black shadow-sm ${
                              r.grade === 'A' ? 'bg-emerald-600 text-white' :
                              r.grade === 'B' ? 'bg-blue-600 text-white' :
                              r.grade === 'C' ? 'bg-emerald-400 text-white' :
                              r.grade === 'P' ? 'bg-amber-500 text-white' :
                              'bg-rose-600 text-white'
                            }`}>
                              {r.grade}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
        <span className="font-bold uppercase tracking-[0.2em] text-xs">Syncing {label}...</span>
      </td>
    </tr>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-8 py-20 text-center">
        <div className="flex flex-col items-center gap-4 text-gray-300">
          <Info size={48} className="opacity-20" />
          <span className="text-xs font-bold uppercase tracking-widest">No matching records found.</span>
        </div>
      </td>
    </tr>
  );
}
