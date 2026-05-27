import React, { useState } from 'react';
import { authService } from '../services/api';
import { BookOpen, User, Lock, ArrowRight, Loader2, Shield, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [loginType, setLoginType] = useState<'teacher' | 'admin' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // FIX: Secure custom first-time setup input states
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginType) return;
    
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.login({ email, password, loginType });
      // FIX: Bug 1 - Save firebaseToken to local storage at login so auth restorer can find it immediately
      if (data && data.firebaseToken) {
        localStorage.setItem('fireToken', data.firebaseToken);
      }
      onLogin(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  // FIX: Secure custom first-time setup logic without hardcoded credentials
  const handleSetup = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!setupName.trim() || !setupEmail.trim() || !setupPassword.trim()) {
      setSetupError('All fields are required.');
      return;
    }
    
    setLoading(true);
    setSetupError('');
    try {
      await authService.setupInitial({
        name: setupName.trim(),
        email: setupEmail.trim().toLowerCase(),
        password: setupPassword,
        role: 'SUPER_ADMIN'
      });
      setSetupSuccess(true);
      // Reset inputs on success for security
      setSetupName('');
      setSetupEmail('');
      setSetupPassword('');
    } catch (err: any) {
      setSetupError('Setup failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const renderLoginForm = (type: 'teacher' | 'admin') => (
    <motion.div
      initial={{ opacity: 0, x: type === 'teacher' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: type === 'teacher' ? 20 : -20 }}
      className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">
          {type === 'teacher' ? 'Teacher Login' : 'Admin Login'}
        </h2>
        <button 
          onClick={() => {
            setLoginType(null);
            setError('');
            setShowPassword(false);
          }}
          className="text-xs font-bold text-blue-600 uppercase tracking-widest hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          Change
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={type === 'teacher' ? "teacher@school.com" : "admin@school.com"}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-medium"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-12 pr-12 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-medium"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full ${type === 'teacher' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-gray-900 hover:bg-black shadow-gray-200'} text-white font-bold py-4 rounded-2x flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] uppercase tracking-widest text-xs`}
        >
          {loading ? <Loader2 className="animate-spin" /> : <span>Sign In</span>}
          <ArrowRight size={20} />
        </button>
      </form>

      {type === 'admin' && (
        <div className="mt-8 pt-8 border-t border-gray-50 text-center">
          <button 
            onClick={() => {
              setShowSetup(!showSetup);
              setSetupError('');
              setSetupSuccess(false);
            }}
            className="text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
            type="button"
          >
            {showSetup ? 'Hide Setup' : 'First time here? Set up Admin'}
          </button>
          {showSetup && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-6 bg-blue-50 rounded-2xl border border-blue-100 text-left space-y-4"
            >
              <p className="text-xs text-blue-700 font-bold uppercase tracking-wider text-center">Create Super Admin Account</p>
              
              {setupError && (
                <div id="setup-error-alert" className="p-3 bg-red-100 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
                  {setupError}
                </div>
              )}
              {setupSuccess && (
                <div id="setup-success-alert" className="p-3 bg-green-100 text-green-700 text-xs rounded-xl border border-green-200 font-medium">
                  Account created successfully! You can now log in above with your credentials.
                </div>
              )}

              {!setupSuccess && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pl-1">Name</label>
                    <input
                      id="setup-name-input"
                      type="text"
                      value={setupName}
                      onChange={(e) => setSetupName(e.target.value)}
                      placeholder="e.g. Administrator"
                      className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-800"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pl-1">Email</label>
                    <input
                      id="setup-email-input"
                      type="email"
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      placeholder="e.g. admin@school.com"
                      className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-800"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pl-1">Password</label>
                    <input
                      id="setup-password-input"
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-800"
                      required
                    />
                  </div>
                  <button 
                    id="setup-submit-btn"
                    onClick={handleSetup}
                    disabled={loading}
                    className="w-full text-xs font-black text-blue-600 uppercase tracking-[0.2em] py-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                    type="button"
                  >
                    {loading ? 'Setting up...' : 'Create Admin'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-blue-200 rotate-3">
            <BookOpen size={32} />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">EduNexus</h1>
          <p className="text-gray-400 font-medium italic">Empowering education, one login at a time.</p>
        </motion.div>

        {!loginType ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.button
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLoginType('teacher')}
              className="group bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all text-center"
            >
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6 group-hover:scale-110 transition-transform">
                <User size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Teacher</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Login to Dashboard</p>
            </motion.button>

            <motion.button
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLoginType('admin')}
              className="group bg-gray-900 p-10 rounded-[2.5rem] border border-gray-800 shadow-xl hover:bg-black transition-all text-center"
            >
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Shield size={32} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Admin</h3>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">School Management</p>
            </motion.button>
          </div>
        ) : (
          renderLoginForm(loginType)
        )}

        <p className="text-center text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-16">
          © {new Date().getFullYear()} EduNexus Systems. Lagos, Nigeria.
        </p>
      </div>
    </div>
  );
}
