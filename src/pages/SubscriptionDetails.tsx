import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, ShieldCheck, Clock, Zap, Loader2 } from 'lucide-react';
import { subscriptionService } from '../services/api';

export default function SubscriptionDetails() {
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSub();
  }, []);

  const fetchSub = async () => {
    try {
      const res = await subscriptionService.getMySubscription();
      setSub(res.data);
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Verifying License...</span>
      </div>
    );
  }

  const remainingDays = sub?.endDate ? Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="text-center pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
          <ShieldCheck size={14} />
          <span>Institutional Licence</span>
        </div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic">Plan & Subscription</h1>
        <p className="text-gray-500 font-medium mt-2">Transparency regarding your school's current standing with EduNexus.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm space-y-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full" />
           
           <div>
             <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Current Tier</div>
             <div className="text-5xl font-black text-gray-900 tracking-tighter italic">{sub?.plan || 'BASIC'}</div>
           </div>

           <div className="space-y-4">
              <div className="flex items-center justify-between py-4 border-t border-gray-50">
                <div className="flex items-center gap-3 text-gray-400">
                   <Clock size={18} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Time Remaining</span>
                </div>
                <span className="font-black text-gray-900">{remainingDays} Days</span>
              </div>
              <div className="flex items-center justify-between py-4 border-t border-gray-50">
                <div className="flex items-center gap-3 text-gray-400">
                   <Calendar size={18} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Expiry Date</span>
                </div>
                <span className="font-bold text-gray-900">{sub?.endDate || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-4 border-t border-gray-50">
                <div className="flex items-center gap-3 text-gray-400">
                   <CreditCard size={18} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Amount Paid</span>
                </div>
                <span className="font-black text-gray-900">${sub?.amount?.toLocaleString() || 0}</span>
              </div>
           </div>
        </div>

        <div className="bg-gray-900 text-white p-10 rounded-[3rem] shadow-2xl space-y-8 flex flex-col justify-between">
           <div className="space-y-6">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400">
                <Zap size={28} />
              </div>
              <h3 className="text-2xl font-black tracking-tight leading-tight">Your school is currently in <span className="text-blue-400">{sub?.status || 'ACTIVE'}</span> status.</h3>
              <p className="text-sm text-gray-400 font-medium leading-relaxed">
                Management of all departments, teachers, and student records are synced with our cloud matrix. 
                Ensure your subscription is valid to prevent service interruption.
              </p>
           </div>
           
           <button className="w-full py-5 bg-white text-gray-900 font-black uppercase tracking-[0.3em] text-[10px] rounded-2xl hover:bg-blue-50 transition-all active:scale-95">
              Contact Billing Dept.
           </button>
        </div>
      </div>
    </div>
  );
}
