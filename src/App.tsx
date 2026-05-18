import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Results from './pages/Results';
import Schools from './pages/Schools';
import Attendance from './pages/Attendance';
import ActivityLogs from './pages/ActivityLogs';
import Profile from './pages/Profile';
import SchoolSettings from './pages/SchoolSettings';
import SchoolAdmins from './pages/SchoolAdmins';
import Subscriptions from './pages/Subscriptions';
import PlatformReports from './pages/PlatformReports';
import Announcements from './pages/Announcements';
import SupportTickets from './pages/SupportTickets';
import PlatformSettings from './pages/PlatformSettings';
import Layout from './components/Layout';
import InstallPWA from './components/InstallPWA';
import { authService } from './services/api';
import { auth } from './lib/firebase.ts';
import { signInWithCustomToken } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const safeLocalStorage = {
    getItem: (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('Storage failed:', e);
      }
    },
    removeItem: (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // ignore
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = safeLocalStorage.getItem('token');
        const savedUser = safeLocalStorage.getItem('user');
        const fireToken = safeLocalStorage.getItem('fireToken');
        
        if (token && savedUser) {
          if (fireToken) {
            signInWithCustomToken(auth, fireToken).catch(err => console.error('Firebase Re-auth failed:', err));
          }
          // Optimistic update: Show UI immediately if we have cached user
          try {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            // We set loading to false here so the UI shows up immediately
            setLoading(false);

            // Verify session in background
            const { data } = await authService.getCurrentUser();
            // If data differs or token refreshed, update state
            setUser(data.user);
            safeLocalStorage.setItem('user', JSON.stringify(data.user));
          } catch (err: any) {
            console.error('Session validation failed in background:', err);
            if (err.response?.status === 401) {
              handleLogout();
            }
          }
        } else {
          // No session found
          safeLocalStorage.removeItem('user');
          safeLocalStorage.removeItem('token');
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleLogin = (userData: any) => {
    const userToSave = userData.user || userData; 
    setUser(userToSave);
    safeLocalStorage.setItem('user', JSON.stringify(userToSave));
    safeLocalStorage.setItem('token', userData.token);
    if (userData.firebaseToken) {
      safeLocalStorage.setItem('fireToken', userData.firebaseToken);
      signInWithCustomToken(auth, userData.firebaseToken).catch(console.error);
    }
  };

  const handleLogout = () => {
    setUser(null);
    safeLocalStorage.removeItem('user');
    safeLocalStorage.removeItem('token');
    safeLocalStorage.removeItem('fireToken');
  };

  const refreshUser = async () => {
    try {
      const { data } = await authService.getCurrentUser();
      setUser(data.user);
      safeLocalStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      throw err;
    }
  };

  const updateUser = (newData: any) => {
    const updatedUser = { ...user, ...newData };
    setUser(updatedUser);
    safeLocalStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
    if (loading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!user) return <Navigate to="/login" replace />;
    if (roles && user?.role && !roles.includes(user.role)) return <Navigate to="/" replace />;
    if (roles && !user?.role) return <Navigate to="/" replace />;
    return <>{children}</>;
  };

  const OPERATIONAL_ROLES = ['SCHOOL_ADMIN', 'TEACHER'];

  return (
    <Router>
      <InstallPWA />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout user={user} onLogout={handleLogout}>
              <Dashboard user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/students" element={
          <ProtectedRoute roles={OPERATIONAL_ROLES}>
            <Layout user={user} onLogout={handleLogout}>
              <Students user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/teachers" element={
          <ProtectedRoute roles={['SCHOOL_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <Teachers user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/classes" element={
          <ProtectedRoute roles={OPERATIONAL_ROLES}>
            <Layout user={user} onLogout={handleLogout}>
              <Classes user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/subjects" element={
          <ProtectedRoute roles={OPERATIONAL_ROLES}>
            <Layout user={user} onLogout={handleLogout}>
              <Subjects user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/results" element={
          <ProtectedRoute roles={OPERATIONAL_ROLES}>
            <Layout user={user} onLogout={handleLogout}>
              <Results user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/attendance" element={
          <ProtectedRoute roles={['SCHOOL_ADMIN', 'TEACHER']}>
            <Layout user={user} onLogout={handleLogout}>
              <Attendance user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/activity-logs" element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <ActivityLogs user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <Layout user={user} onLogout={handleLogout}>
              <Profile user={user} updateUser={updateUser} refreshUser={refreshUser} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/schools" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <Schools />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/super-admin/admins" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <SchoolAdmins />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/super-admin/subscriptions" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <Subscriptions />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/super-admin/reports" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <PlatformReports />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/super-admin/announcements" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <Announcements />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/super-admin/support" element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <SupportTickets user={user} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/super-admin/settings" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <PlatformSettings />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/settings/school" element={
          <ProtectedRoute roles={['SCHOOL_ADMIN']}>
            <Layout user={user} onLogout={handleLogout}>
              <SchoolSettings user={user} refreshUser={refreshUser} />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
