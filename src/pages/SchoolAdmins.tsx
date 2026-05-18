import React, { useState, useEffect } from 'react';
import { UserPlus, Search, MessageSquare, Shield, Loader2, School as SchoolIcon } from 'lucide-react';
import { schoolService } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function SchoolAdmins() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await schoolService.list();
      setSchools(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.adminName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.adminEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMessageAdmin = (school: any) => {
    navigate(`/messages`, { state: { selectedChatId: school.id, selectedSchoolName: school.name } });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic">Institutional Admins</h1>
          <p className="text-gray-500 font-medium mt-1">Direct management of school owners and administrative delegates.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search admins or schools..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-gray-50 rounded-2xl border-transparent focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-4">
               <div className="flex flex-col items-end">
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Administrative Nodes</span>
                 <span className="text-xl font-black text-gray-900 tracking-tighter">{schools.length}</span>
               </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Identity</th>
                  <th className="text-left px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Linked Institution</th>
                  <th className="text-left px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subscription & Revenue</th>
                  <th className="text-left px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-6 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-blue-600" size={32} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Synchronizing Tenant Data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSchools.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic text-sm">No administrators found matching your criteria.</td>
                  </tr>
                ) : (
                  filteredSchools.map((school) => (
                    <tr key={school.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-sm border border-indigo-100">
                             {school.adminName?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 tracking-tight">{school.adminName || 'Unassigned'}</div>
                            <div className="text-xs text-gray-500 font-medium">{school.adminEmail || 'No email set'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100">
                             {school.logoUrl ? <img src={school.logoUrl} className="w-full h-full object-cover" /> : <SchoolIcon size={14} className="text-gray-400" />}
                           </div>
                           <span className="font-bold text-gray-900 text-sm tracking-tight">{school.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{school.plan || 'BASIC'}</span>
                             <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">${school.subscriptionAmount?.toLocaleString() || 0}</span>
                          </div>
                          <div className="text-[9px] font-bold text-gray-400 uppercase">Expiry: {school.subscriptionEndDate || 'Lifetime'}</div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          school.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {school.subscriptionStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => handleMessageAdmin(school)}
                          className="inline-flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
                        >
                          <MessageSquare size={14} />
                          <span>Message Admin</span>
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
    </div>
  );
}
