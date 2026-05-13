import React from 'react';
import { CreditCard, ArrowUpRight, CheckCircle2, AlertCircle, Zap } from 'lucide-react';

export default function Subscriptions() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Subscriptions & Billing</h1>
        <p className="text-gray-500 font-medium mt-1">Monitor revenue, plans, and payment status across all schools.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Monthly Revenue', value: '$24,500', icon: CreditCard, color: 'blue', change: '+12.5%' },
          { label: 'Active Plans', value: '156', icon: CheckCircle2, color: 'emerald', change: '+8%' },
          { label: 'Expiring Soon', value: '12', icon: AlertCircle, color: 'rose', change: '-3%' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
             <div className={`w-12 h-12 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl flex items-center justify-center mb-6`}>
               <stat.icon size={22} />
             </div>
             <div className="text-3xl font-black text-gray-900 tracking-tight">{stat.value}</div>
             <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</span>
               <span className="text-[10px] font-black text-emerald-500">{stat.change}</span>
             </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-8">
        <div className="flex items-center justify-between mb-8">
           <h3 className="font-black text-xl text-gray-900 tracking-tight">Recent Transactions</h3>
           <button className="text-blue-600 font-bold text-xs flex items-center gap-2 group">
             <span>Export Billing Details</span>
             <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
           </button>
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-6 bg-gray-50/50 rounded-3xl border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                  <Zap size={20} />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Premium Plan - St. Margaret Academy</div>
                  <div className="text-xs text-gray-500 font-medium">Invoice #INV-2024-00{i} • April 12, 2024</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-gray-900">$499.00</div>
                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Paid</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
