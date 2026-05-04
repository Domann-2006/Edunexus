import React, { useState } from 'react';
import { authService } from '../services/api';
import { BookOpen, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.login({ email, password });
      onLogin(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data } = await authService.setupInitial({
        name: 'Super Admin',
        email: 'admin@edunexus.com',
        password: 'password123',
        role: 'SUPER_ADMIN'
      });
      alert('Initial admin created: admin@edunexus.com / password123');
      setEmail('admin@edunexus.com');
      setPassword('password123');
    } catch (err: any) {
      setError('Setup failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-blue-100">
            <BookOpen size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">EduNexus</h1>
          <p className="text-gray-500 mt-2">School management made minimal.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-100 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" /> : <span>Sign In</span>}
              <ArrowRight size={20} />
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-50 text-center">
            <button 
              onClick={() => setShowSetup(!showSetup)}
              className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              First time here?
            </button>
            {showSetup && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100"
              >
                <p className="text-xs text-blue-700 mb-3">Create a Super Admin account to get started.</p>
                <button 
                  onClick={handleSetup}
                  className="text-xs font-bold text-blue-600 uppercase tracking-wider"
                >
                  Setup Account
                </button>
              </motion.div>
            )}
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-10">
          © 2024 EduNexus Systems. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
