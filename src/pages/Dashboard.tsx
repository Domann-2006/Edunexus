import React, { useState, useEffect } from 'react';
import api, { dashboardService, schoolService, classService } from '../services/api';
import { 
  Users, 
  UserPlus, 
  BookOpen, 
  School,
  TrendingUp,
  ArrowRight,
  Book,
  Calendar,
  FileSpreadsheet,
  Zap,
  MoreVertical,
  CheckSquare,
  CreditCard,
  Megaphone,
  LifeBuoy,
  PieChart
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export default function Dashboard({ user }: { user: any }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [teacherProfile, setTeacherProfile] = useState<any>(null);
  const [assignedClasses, setAssignedClasses] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      schoolService.list().then(res => setSchools(res.data));
    }
    if (user?.role === 'TEACHER') {
      // Get teacher profile and assigned classes
      const fetchTeacherData = async () => {
        try {
          const profileRes = await api.get('/v1/teachers', { params: { userId: user.id } });
          if (profileRes.data.length > 0) {
            const profile = profileRes.data[0];
            setTeacherProfile(profile);
            if (profile.assignedClassIds?.length > 0) {
              const classesRes = await classService.list();
              setAssignedClasses(classesRes.data);
            }
          }
        } catch (err) {
          console.error('Failed to fetch teacher profile:', err);
        }
      };
      fetchTeacherData();
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    dashboardService.getStats({ schoolId: selectedSchoolId })
      .then(res => setStats(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const superAdminCards = [
    { name: 'Total Schools', value: stats?.schools || 0, icon: School, color: 'blue', link: '/schools' },
    { name: 'Total Teachers', value: stats?.totalTeachers || 0, icon: UserPlus, color: 'indigo', link: '/super-admin/admins' },
    { name: 'Total Students', value: stats?.totalStudents || 0, icon: Users, color: 'emerald', link: '/super-admin/reports' },
    { name: 'Active Subscriptions', value: stats?.activePlans || 0, icon: CreditCard, color: 'rose', link: '/super-admin/subscriptions' },
  ];

  const statCards = user?.role === 'SUPER_ADMIN' 
    ? superAdminCards
    : user?.role === 'TEACHER' 
      ? [
          { name: 'My Students', value: stats?.students || 0, icon: Users, color: 'blue', link: '/students' },
          { name: 'My Classes', value: teacherProfile?.assignedClassIds?.length || 0, icon: BookOpen, color: 'emerald', link: '/classes' },
          { name: 'My Subjects', value: teacherProfile?.assignedSubjectIds?.length || 0, icon: Book, color: 'amber', link: '/subjects' },
          { name: 'Attendance Stats', value: 'Live', icon: CheckSquare, color: 'indigo', link: '/attendance' },
        ]
      : [
          { name: 'Students', value: stats?.students || 0, icon: Users, color: 'blue', link: '/students' },
          { name: 'Teachers', value: stats?.teachers || 0, icon: UserPlus, color: 'indigo', link: '/teachers' },
          { name: 'Classes', value: stats?.classes || 0, icon: BookOpen, color: 'emerald', link: '/classes' },
          { name: 'Subjects', value: stats?.subjects || 0, icon: Book, color: 'amber', link: '/subjects' },
        ];

  const chartData = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 },
  ];

  return (
    <div className="space-y-12 pb-20">
      <header id="overview-header" className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
            {user?.role === 'SUPER_ADMIN' ? 'Platform Dashboard' : 'Overview'}
          </h1>
          <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">
            {user?.role === 'SUPER_ADMIN' ? 'Global Platform Analytics & Management' : `Academic Year ${new Date().getMonth() >= 8 ? `${new Date().getFullYear()}/${new Date().getFullYear() + 1}` : `${new Date().getFullYear() - 1}/${new Date().getFullYear()}`} • ${new Date().getMonth() < 3 ? 'Second Term' : new Date().getMonth() < 7 ? 'Third Term' : 'First Term'}`}
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          {user?.role === 'SUPER_ADMIN' && (
            <select
              id="school-selector"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="px-5 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <Calendar size={18} className="text-blue-600" />
            <span className="text-sm font-bold text-gray-700 tracking-tight">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          {user?.role === 'SCHOOL_ADMIN' && (
            <button className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
              <Zap size={20} />
            </button>
          )}
        </div>
      </header>

      <div id="stat-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-[2.5rem]" />
          ))
        ) : (
          statCards.map((card, i) => (
            <motion.div
              key={card.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <card.icon size={22} />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-4xl font-black text-gray-900 tracking-tight">{card.value}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">{card.name}</div>
              </div>
              <Link to={card.link} className="absolute inset-0 z-20"></Link>
            </motion.div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {user?.role === 'TEACHER' ? 'My Assigned Classes' : 'Active Enrollment'}
            </h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500 rounded-xl">
                {user?.role === 'TEACHER' ? 'Current Term' : 'Last 6 Months'}
              </button>
              <button className="p-2 text-gray-400"><MoreVertical size={18} /></button>
            </div>
          </div>
          
          {user?.role === 'TEACHER' ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Assigned Classes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {assignedClasses.length > 0 ? (
                    assignedClasses.map((c, i) => {
                      const isClassAssigned = (teacherProfile?.classAssignments || []).includes(c.id);
                      const assignedSubs = (teacherProfile?.subjectAssignments || []).filter(sa => sa.classId === c.id);
                      const hasSubjectAssignments = assignedSubs.length > 0;
                      return (
                        <Link 
                          to={`/students?classId=${c.id}`}
                          key={c.id} 
                          className="p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-blue-200 hover:bg-blue-50/30 transition-all group animate-fade-in flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                                <BookOpen size={20} />
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {isClassAssigned && (
                                  <span className="text-[8.5px] font-black text-purple-705 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-purple-100/50">
                                    Class Teacher
                                  </span>
                                )}
                                {hasSubjectAssignments && (
                                  <span className="text-[8.5px] font-black text-amber-705 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-100/50">
                                    Subject Teacher
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors uppercase">{c.name}</div>
                            <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold font-sans">Level: {c.level}</div>
                          </div>

                          {hasSubjectAssignments && (
                            <div className="mt-4 pt-3 border-t border-gray-100/70">
                              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">My Subjects:</div>
                              <div className="flex flex-wrap gap-1">
                                {assignedSubs.map((sa, sIdx) => (
                                  <span key={sIdx} className="px-1.5 py-0.5 bg-amber-50 border border-amber-100/50 text-amber-600 rounded-lg text-[9px] font-bold">
                                    {sa.subjectName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </Link>
                      );
                    })
                  ) : (
                    <div className="col-span-2 py-10 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-100 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-300 shadow-sm mb-3">
                        <BookOpen size={20} />
                      </div>
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No assigned class yet</p>
                      <p className="text-[9px] text-gray-400 mt-1 italic">Ask your school administrator to configure class assignments.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Assigned Subjects Overview</h3>
                {teacherProfile?.subjectAssignments?.length > 0 ? (
                  <div className="flex flex-wrap gap-2 animate-fade-in">
                    {teacherProfile.subjectAssignments.map((sa: any, idx: number) => (
                      <span 
                        key={idx} 
                        className="px-4 py-2 bg-amber-50 border border-amber-100/50 text-amber-700 font-bold rounded-2xl text-[10px] uppercase tracking-wider flex items-center gap-2"
                      >
                        <Book size={12} className="text-amber-500" />
                        {sa.subjectName} ({sa.className})
                      </span>
                    ))}
                  </div>
                ) : teacherProfile?.assignedSubjectIds?.length > 0 ? (
                  <div className="flex flex-wrap gap-2 animate-fade-in">
                    {teacherProfile.assignedSubjectIds.map((subject: string, idx: number) => (
                      <span 
                        key={idx} 
                        className="px-4 py-2 bg-amber-50 border border-amber-100/50 text-amber-700 font-bold rounded-2xl text-[10px] uppercase tracking-wider flex items-center gap-2"
                      >
                        <Book size={12} className="text-amber-500" />
                        {subject}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-100 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-300 shadow-sm mb-3">
                      <Book size={20} />
                    </div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No assigned subject yet</p>
                    <p className="text-[9px] text-gray-400 mt-1 italic">Ask your school administrator to configure subject assignments.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
               <div className="text-center">
                  <PieChart className="mx-auto text-gray-300 mb-2" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Trend logs propagating...</p>
               </div>
            </div>
          )}
        </div>

        <div id="quick-actions" className="bg-gray-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="relative z-10 flex flex-col h-full">
            <h2 className="text-2xl font-black tracking-tight leading-tight mb-4">Quick Actions</h2>
            <div className="space-y-3 mt-4">
              {user?.role === 'SUPER_ADMIN' ? (
                <>
                  <Link to="/schools" className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all group">
                    <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center">
                      <School size={18} />
                    </div>
                    <span className="text-sm font-bold">Register New School</span>
                    <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
                  </Link>
                  <Link to="/super-admin/announcements" className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all group">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center">
                      <Megaphone size={18} />
                    </div>
                    <span className="text-sm font-bold">Global Announcement</span>
                    <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
                  </Link>
                  <Link to="/messages" className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all group">
                    <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center">
                      <LifeBuoy size={18} />
                    </div>
                    <span className="text-sm font-bold">Support Desk</span>
                    <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
                  </Link>
                </>
              ) : (
                <>
                  {(user?.role === 'TEACHER') && (
                    <Link to="/attendance" className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all group">
                      <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center">
                        <CheckSquare size={18} />
                      </div>
                      <span className="text-sm font-bold">Mark Attendance</span>
                      <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
                    </Link>
                  )}
                  <Link to="/results" className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all group">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center">
                      <FileSpreadsheet size={18} />
                    </div>
                    <span className="text-sm font-bold">Record Results</span>
                    <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
                  </Link>
                   <Link to="/messages" className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all group">
                    <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center">
                      <LifeBuoy size={18} />
                    </div>
                    <span className="text-sm font-bold">Support Chat</span>
                    <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
                  </Link>
                </>
              )}
            </div>

            <div className="mt-auto pt-10">
              <div className="p-6 bg-blue-600 rounded-[2rem] relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-1">Status</div>
                  <div className="text-lg font-black tracking-tight mb-4">Direct Helpdesk</div>
                  <Link to="/messages" className="w-full flex items-center justify-center py-3 bg-white text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest group-hover:scale-105 transition-transform">Start Chat</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
