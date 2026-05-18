import React, { useState, useEffect } from 'react';
import { CreditCard, ArrowUpRight, CheckCircle2, AlertCircle, Zap, Loader2 } from 'lucide-react';
import { subscriptionService } from '../services/api';

export default function Subscriptions() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await subscriptionService.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Aggregating Economic Data...</span>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Ecosystem Revenue', value: `$${stats?.totalRevenue?.toLocaleString() || '0'}`, icon: CreditCard, color: 'blue' },
    { label: 'Active Institutional Licences', value: stats?.activeSubscriptions || 0, icon: CheckCircle2, color: 'emerald' },
    { label: 'Expired/Pending Matrix', value: stats?.expiredSubscriptions || 0, icon: AlertCircle, color: 'rose' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic">Ecosystem Economics</h1>
        <p className="text-gray-500 font-medium mt-2">Quantitative analysis of platform value and subscription distribution.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
             <div className={`w-14 h-14 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl flex items-center justify-center mb-8`}>
               <stat.icon size={24} />
             </div>
             <div className="text-4xl font-black text-gray-900 tracking-tighter">{stat.value}</div>
             <div className="flex items-center gap-2 mt-2">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{stat.label}</span>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full" />
           <h3 className="font-black text-xl tracking-tight mb-8">Plan Distribution Matrix</h3>
           <div className="space-y-6 relative z-10">
              {Object.entries(stats?.byPlan || {}).map(([plan, count]: any) => {
                const total = stats?.totalSchools || 1;
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={plan} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span>{plan}</span>
                      <span className="text-gray-400">{count} Institutions ({percentage}%)</span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
           </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-10">
          <div className="flex items-center justify-between mb-8">
             <h3 className="font-black text-xl text-gray-900 tracking-tight">Financial Health</h3>
             <Zap className="text-amber-500" size={24} />
          </div>
          
          <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
             <div className="text-6xl font-black text-gray-900 tracking-tighter italic">{(stats?.activeSubscriptions / stats?.totalSchools * 100).toFixed(1)}%</div>
             <div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Retention Health Index</div>
                <p className="text-xs text-gray-500 max-w-[240px] mt-2 font-medium">Percentage of total onboarded schools currently maintaining active licenses.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
