import React, { useState, useEffect } from 'react';
import { schoolService } from '../services/api';
import { Save, Loader2, Info, MapPin, Phone, CreditCard, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import ProfileImage from '../components/ProfileImage';

export default function SchoolSettings({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    logoUrl: '',
    plan: '',
  });

  useEffect(() => {
    if (user?.schoolId) {
      fetchSchool();
    }
  }, [user]);

  const fetchSchool = async () => {
    setLoading(true);
    try {
      const res = await schoolService.list({ id: user.schoolId });
      // Find the specific school if list returns an array, or it might just be a direct fetch
      // Based on schoolService.list implementation: api.get('/v1/schools', { params })
      const schoolData = Array.isArray(res.data) ? res.data.find((s: any) => s.id === user.schoolId) : res.data;
      
      if (schoolData) {
        setSchool(schoolData);
        setFormData({
          name: schoolData.name || '',
          address: schoolData.address || '',
          phone: schoolData.phone || '',
          logoUrl: schoolData.logoUrl || '',
          plan: schoolData.plan || 'BASIC',
        });
      }
    } catch (err) {
      console.error('Failed to fetch school details:', err);
      setError('Could not load school settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await schoolService.update(user.schoolId, formData);
      setSuccess('School settings updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">School Settings</h1>
        <p className="text-gray-500 mt-1">Configure your institution's profile and preferences.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Quick Info Sidebar */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm text-center">
            <div className="flex justify-center mb-6">
              <ProfileImage 
                size="xl" 
                editable 
                url={formData.logoUrl} 
                onUpload={(url) => setFormData({...formData, logoUrl: url})} 
                folder="schools"
              />
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{formData.name || 'School Name'}</h2>
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                {formData.plan} Plan
              </div>
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">ID: {user.schoolId.slice(0, 8)}...</span>
            </div>
          </div>

          <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl">
            <h3 className="text-sm font-black uppercase tracking-widest opacity-60 mb-6 flex items-center gap-2">
              <CreditCard size={18} className="text-blue-400" />
              Subscription
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Current Plan</p>
                <p className="text-lg font-bold text-blue-400">{formData.plan}</p>
              </div>
              <div className="pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">User Limit</p>
                <p className="text-lg font-bold">{school?.userLimit || '50'} Users</p>
              </div>
              <button className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all active:scale-95">
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>

        {/* Main Settings Form */}
        <div className="md:col-span-2">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100 flex items-center gap-3">
                  <Info size={18} />
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 text-emerald-600 text-sm rounded-2xl border border-emerald-100 flex items-center gap-3">
                  <ShieldCheck size={18} />
                  {success}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Institution Name</label>
                  <div className="relative">
                    <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-12 pr-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                      placeholder="School Name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Official Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full pl-12 pr-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                      placeholder="Street, City"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Contact Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full pl-12 pr-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900 font-mono"
                      placeholder="+234..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Current Plan (Read Only)</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="text"
                      disabled
                      value={formData.plan}
                      className="w-full pl-12 pr-6 py-4 bg-gray-100 border-0 rounded-2xl cursor-not-allowed outline-none font-bold text-gray-400"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter ml-1">Contact Super Admin to change subscription plan.</p>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-10 py-5 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
