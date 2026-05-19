import React, { useState, useEffect } from 'react';
import { schoolService, authService, sessionService } from '../services/api';
import { Save, Loader2, Info, MapPin, Phone, CreditCard, ShieldCheck, Calendar, PlusCircle, CheckCircle, Trash2, Settings, Plus, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import ProfileImage from '../components/ProfileImage';

export default function SchoolSettings({ 
  user,
  refreshUser
}: { 
  user: any;
  refreshUser: () => Promise<any>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Tab and Academic Session States
  const [activeTab, setActiveTab] = useState<'general' | 'sessions'>('general');
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionActiveTerm, setNewSessionActiveTerm] = useState('1st');
  const [newSessionIsCurrent, setNewSessionIsCurrent] = useState(true);
  const [sessionActionLoading, setSessionActionLoading] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    logoUrl: '',
    plan: '',
    // Admin personal info
    adminName: user?.name || '',
    adminPhone: user?.phone || '',
    adminAddress: user?.address || '',
  });

  useEffect(() => {
    if (user?.schoolId) {
      fetchSchool();
    } else if (user) {
      setLoading(false);
      setError('Your account is not linked to a school. Please contact support.');
    }
  }, [user]);

  // Academic Sessions Functions
  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await sessionService.list();
      setSessions(res.data);
    } catch (err) {
      console.error('Failed to load academic sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (newSessionIsCurrent) {
        const currentActive = sessions.filter(s => s.isCurrent);
        await Promise.all(
          currentActive.map(s => sessionService.update(s.id, { isCurrent: false }))
        );
      }
      
      await sessionService.create({
        name: newSessionName.trim(),
        isCurrent: newSessionIsCurrent,
        activeTerm: newSessionActiveTerm,
        schoolId: user?.schoolId
      });
      
      setNewSessionName('');
      setNewSessionIsCurrent(true);
      setNewSessionActiveTerm('1st');
      setSuccess('Academic session created successfully!');
      fetchSessions();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error('Failed to create session:', err);
      setError(err.response?.data?.message || 'Could not create academic session.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateSession = async (sessionId: string) => {
    setSessionActionLoading(sessionId);
    setError('');
    setSuccess('');
    try {
      const currentActive = sessions.filter(s => s.isCurrent && s.id !== sessionId);
      await Promise.all(
        currentActive.map(s => sessionService.update(s.id, { isCurrent: false }))
      );
      
      await sessionService.update(sessionId, { isCurrent: true });
      setSuccess('Active academic session updated successfully!');
      fetchSessions();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error('Failed to activate session:', err);
      setError('Could not update active session.');
    } finally {
      setSessionActionLoading(null);
    }
  };

  const handleChangeSessionTerm = async (sessionId: string, term: string) => {
    setSessionActionLoading(sessionId);
    setError('');
    setSuccess('');
    try {
      await sessionService.update(sessionId, { activeTerm: term });
      setSuccess(`Active term updated to ${term} Term!`);
      fetchSessions();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error('Failed to update term:', err);
      setError('Could not update active term.');
    } finally {
      setSessionActionLoading(null);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This will remove results context associated with it.')) return;
    setSessionActionLoading(sessionId);
    setError('');
    setSuccess('');
    try {
      await sessionService.delete(sessionId);
      setSuccess('Academic session deleted!');
      fetchSessions();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error('Failed to delete session:', err);
      setError('Could not delete session.');
    } finally {
      setSessionActionLoading(null);
    }
  };

  const fetchSchool = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await schoolService.list();
      const schoolData = Array.isArray(res.data) 
        ? res.data.find((s: any) => s.id === user.schoolId) || res.data[0]
        : res.data;
      
      if (schoolData) {
        setSchool(schoolData);
        setFormData({
          name: schoolData.name || '',
          address: schoolData.address || '',
          phone: schoolData.phone || '',
          logoUrl: schoolData.logoUrl || '',
          plan: schoolData.plan || 'BASIC',
          adminName: user?.name || '',
          adminPhone: user?.phone || '',
          adminAddress: user?.address || '',
        });
      } else {
        setError('School details not found.');
      }
    } catch (err: any) {
      console.error('Failed to fetch school details:', err);
      setError(err.response?.data?.message || 'Could not load school settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      // 1. Update School Info
      const schoolPayload = {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        logoUrl: formData.logoUrl,
      };

      await schoolService.update(user.schoolId, schoolPayload);

      // 2. Update Admin Profile Info (Sync)
      const adminPayload = {
        name: formData.adminName,
        phone: formData.adminPhone,
        address: formData.adminAddress,
      };
      
      await authService.updateProfile(adminPayload);

      setSuccess('All settings updated successfully! UI synced.');
      
      // 3. Centralized refresh to update Sidebar, Profile, Header etc.
      await refreshUser();
      
      // Refresh local form states just in case
      fetchSchool();
      
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('Update failed:', err);
      setError(err.response?.data?.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-sm font-medium text-gray-500 animate-pulse">Loading school profile...</p>
      </div>
    );
  }

  // If there's a fatal error (no school data and not just a validation error)
  if (!school && error) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-10 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <Info size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Initialization Failed</h2>
        <p className="text-gray-500">{error}</p>
        <button 
          onClick={() => fetchSchool()}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">School Settings</h1>
        <p className="text-gray-500 mt-1">Configure your institution's profile and preferences.</p>
      </header>

      {/* Modern Tab Switcher */}
      <div className="flex gap-4 border-b border-gray-100 pb-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all ${
            activeTab === 'general'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          General Profile
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-6 py-3 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all ${
            activeTab === 'sessions'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          Academic Sessions
        </button>
      </div>

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
                {formData.plan || 'No'} Plan
              </div>
              {user?.schoolId && (
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                  ID: {user.schoolId.slice(0, 8)}...
                </span>
              )}
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

        {/* Main Settings Form / Sessions Manager tab content */}
        <div className="md:col-span-2">
          {activeTab === 'general' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm"
            >
              <form onSubmit={handleSubmit} className="space-y-8">
                {error && (
                  <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100 flex items-center gap-3 shadow-sm lg:p-6">
                    <Info size={20} className="shrink-0" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}
                {success && (
                  <div className="p-4 bg-emerald-50 text-emerald-600 text-sm rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <ShieldCheck size={18} />
                    {success}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">Institution Identity</h3>
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
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">Admin Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Admin Full Name</label>
                        <input
                          type="text"
                          required
                          value={formData.adminName}
                          onChange={(e) => setFormData({...formData, adminName: e.target.value})}
                          className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                          placeholder="Your Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Admin Phone</label>
                        <input
                          type="text"
                          value={formData.adminPhone}
                          onChange={(e) => setFormData({...formData, adminPhone: e.target.value})}
                          className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900 font-mono"
                          placeholder="Admin Phone"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Admin Address</label>
                        <input
                          type="text"
                          value={formData.adminAddress}
                          onChange={(e) => setFormData({...formData, adminAddress: e.target.value})}
                          className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                          placeholder="Admin Home Address"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">Location & Contact</h3>
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
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100 flex items-center gap-3">
                  <Info size={18} />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 text-emerald-600 text-sm rounded-2xl border border-emerald-100 flex items-center gap-3">
                  <ShieldCheck size={18} />
                  <span>{success}</span>
                </div>
              )}

              {/* Add New Session Form Card */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  New Academic Session
                </h3>
                
                <form onSubmit={handleCreateSession} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-sans">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Session Year/Title</label>
                      <input
                        type="text"
                        required
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        placeholder="e.g. 2024/2025"
                        className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900 font-mono"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Default Active Term</label>
                      <select
                        value={newSessionActiveTerm}
                        onChange={(e) => setNewSessionActiveTerm(e.target.value)}
                        className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-gray-900"
                      >
                        <option value="1st">1st Term</option>
                        <option value="2nd">2nd Term</option>
                        <option value="3rd">3rd Term</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="setCurrent"
                      checked={newSessionIsCurrent}
                      onChange={(e) => setNewSessionIsCurrent(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="setCurrent" className="text-xs font-bold text-gray-500 select-none cursor-pointer">
                      Make this the active/current academic session
                    </label>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-[10px] rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                    Create Session
                  </button>
                </form>
              </div>

              {/* Existing Academic Sessions List Card */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest border-b border-gray-50 pb-2">
                  Existing Academic Sessions
                </h3>
                
                {sessionsLoading ? (
                  <div className="py-12 text-center text-gray-400">
                    <Loader2 className="animate-spin inline mr-2" size={20} />
                    Loading sessions...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 font-medium lowercase italic">
                    no sessions created yet. Please create one above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {sessions.map((session) => (
                      <div 
                        key={session.id} 
                        className={`p-6 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          session.isCurrent 
                            ? 'bg-blue-50/50 border-blue-200 shadow-sm' 
                            : 'bg-white border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            session.isCurrent ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-50 text-gray-400'
                          }`}>
                            <Calendar size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 font-mono text-base">{session.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {session.isCurrent ? (
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black uppercase tracking-wider">
                                  Current Active
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleActivateSession(session.id)}
                                  disabled={sessionActionLoading !== null}
                                  className="text-[9px] text-blue-600 hover:text-blue-800 font-black uppercase tracking-wider underline disabled:opacity-50"
                                >
                                  Activate
                                </button>
                              )}
                              <span className="text-[10px] text-gray-400 font-medium font-sans leading-none">• Term: <span className="font-bold text-gray-600">{session.activeTerm || '1st'}</span></span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {/* Term Selector for Session on the Fly */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Active Term:</span>
                            <select
                              value={session.activeTerm || '1st'}
                              onChange={(e) => handleChangeSessionTerm(session.id, e.target.value)}
                              disabled={sessionActionLoading !== null}
                              className="px-3 py-1.5 bg-gray-50 border-0 rounded-xl font-bold text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none font-mono"
                            >
                              <option value="1st">1st Term</option>
                              <option value="2nd">2nd Term</option>
                              <option value="3rd">3rd Term</option>
                            </select>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            disabled={sessionActionLoading !== null || session.isCurrent}
                            className={`p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent`}
                            title={session.isCurrent ? "Cannot delete the active session" : "Delete Session"}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
