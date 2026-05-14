import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, BookOpen, Book, Shield, Clock } from 'lucide-react';
import api, { classService, authService } from '../services/api';
import ProfileImage from '../components/ProfileImage';

export default function Profile({ 
  user, 
  updateUser, 
  refreshUser 
}: { 
  user: any; 
  updateUser: (data: any) => void;
  refreshUser: () => Promise<any>;
}) {
  const [teacherProfile, setTeacherProfile] = useState<any>(null);
  const [assignedClasses, setAssignedClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  useEffect(() => {
    fetchProfile();
    setFormData({
      name: user?.name || '',
      phone: user?.phone || '',
      address: user?.address || '',
    });
  }, [user]);

  const handleUpdateProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await authService.updateProfile(formData);
      await refreshUser();
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (url: string) => {
    try {
      await authService.updateProfile({ avatarUrl: url });
      await refreshUser();
    } catch (err) {
      console.error('Avatar sync failed:', err);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (user.role === 'TEACHER') {
        const res = await api.get('/v1/teachers', { params: { userId: user.id } });
        if (res.data.length > 0) {
          const profile = res.data[0];
          setTeacherProfile(profile);
          
          if (profile.assignedClassIds?.length > 0) {
            const classesRes = await classService.list({ schoolId: user.schoolId });
            const filtered = classesRes.data.filter((c: any) => profile.assignedClassIds.includes(c.name) || profile.assignedClassIds.includes(c.id));
            setAssignedClasses(filtered);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const profileData = user.role === 'TEACHER' && teacherProfile ? teacherProfile : user;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Profile</h1>
        <p className="text-gray-500 mt-1">Manage your personal information and account settings.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm text-center">
            <div className="flex justify-center mb-6">
              <ProfileImage 
                url={user?.avatarUrl || (user?.role === 'SCHOOL_ADMIN' ? user?.schoolLogo : undefined)} 
                size="xl" 
                editable={true} 
                onUpload={handleAvatarUpload}
              />
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{profileData.name}</h2>
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mt-2">
              {user.role?.replace('_', ' ')}
            </div>
            {user.schoolName && (
              <div className="text-xs text-gray-400 font-bold mt-3 uppercase tracking-wider">{user.schoolName}</div>
            )}
          </div>

          <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest opacity-60">Security</h3>
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-blue-400" />
                <span className="text-sm font-bold text-white/90">Password Encrypted</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-blue-400" />
                <span className="text-sm font-bold text-white/90">Last Login: Just now</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Personal Information</h3>
              {success && (
                <span className="text-xs font-bold text-emerald-600 animate-pulse">{success}</span>
              )}
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <User size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Full Name</span>
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full font-bold text-gray-900 border-b border-gray-100 focus:border-blue-500 outline-none pb-2 bg-transparent transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Mail size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Email Address (Read Only)</span>
                  </div>
                  <div className="font-bold text-gray-400 border-b border-gray-50 pb-2 cursor-not-allowed">{profileData.email}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Phone size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Phone Number</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Provide phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full font-bold text-gray-900 border-b border-gray-100 focus:border-blue-500 outline-none pb-2 bg-transparent transition-all"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <MapPin size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Home Address</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Provide address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full font-bold text-gray-900 border-b border-gray-100 focus:border-blue-500 outline-none pb-2 bg-transparent transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Clock className="animate-spin" size={12} />}
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>

          {user.role === 'TEACHER' && (
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Academic Assignments</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-gray-400 mb-3">
                    <BookOpen size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Assigned Classes</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedClasses.length > 0 ? assignedClasses.map(c => (
                      <span key={c.id} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl text-xs font-black uppercase tracking-tighter shadow-sm border border-blue-100">
                        {c.name}
                      </span>
                    )) : teacherProfile?.assignedClassIds?.map((cName: string) => (
                      <span key={cName} className="px-4 py-2 bg-gray-50 text-gray-500 rounded-2xl text-xs font-black uppercase tracking-tighter border border-gray-100">
                        {cName}
                      </span>
                    )) || <span className="text-xs text-gray-400 italic">None assigned</span>}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-400 mb-3">
                    <Book size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Subjects</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {teacherProfile?.assignedSubjectIds?.length > 0 ? teacherProfile.assignedSubjectIds.map((sName: string) => (
                      <span key={sName} className="px-4 py-2 bg-amber-50 text-amber-600 rounded-2xl text-xs font-black uppercase tracking-tighter border border-amber-100">
                        {sName}
                      </span>
                    )) : <span className="text-xs text-gray-400 italic">None assigned</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
