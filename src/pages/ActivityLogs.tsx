import React, { useState, useEffect } from 'react';
import { activityService, schoolService } from '../services/api';
import { Shield, Clock, User, Info, Search, Filter, Loader2, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

export default function ActivityLogs({ user }: { user: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  useEffect(() => {
    fetchData();
    if (user?.role === 'SUPER_ADMIN') {
      schoolService.list().then(res => setSchools(res.data));
    }
  }, [selectedSchoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await activityService.list({ 
        schoolId: selectedSchoolId || user?.schoolId,
        sort: 'createdAt:desc' 
      });
      // Filter by search client-side for simplicity if needed, or refine API
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(log => 
    log.action?.toLowerCase().includes(search.toLowerCase()) ||
    log.userName?.toLowerCase().includes(search.toLowerCase()) ||
    log.details?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Audit Logs</h1>
          <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Track system activity and teacher actions.</p>
        </div>
        <div className="flex gap-4">
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
            Refresh
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-sm uppercase">
        <div className="p-4 border-b border-gray-50 flex items-center gap-3">
          <Search className="text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search logs by action, user, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 focus:ring-0 outline-none p-2"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 text-xs font-bold tracking-widest border-b border-gray-50">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 uppercase tracking-tight">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <Loader2 className="animate-spin inline mr-2 text-blue-600" size={20} />
                    Loading Logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium lowercase">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500 whitespace-nowrap">
                        <Clock size={14} className="text-blue-400" />
                        <span className="text-[10px] font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{log.userName || 'System'}</span>
                        <span className="text-[9px] text-gray-400 normal-case">{log.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg font-bold text-[10px] ${
                        log.action.includes('CREATE') ? 'bg-green-50 text-green-600' :
                        log.action.includes('DELETE') ? 'bg-red-50 text-red-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] text-gray-500 normal-case line-clamp-2 max-w-md">
                        {log.details}
                      </p>
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
