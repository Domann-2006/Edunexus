import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import Schools from './pages/Schools';
import Layout from './components/Layout';

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userData.token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
    return <>{children}</>;
  };

  return (
    <Router>
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
          <ProtectedRoute>
            <Layout user={user} onLogout={handleLogout}>
              <Students />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/teachers" element={
          <ProtectedRoute>
            <Layout user={user} onLogout={handleLogout}>
              <Teachers />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/classes" element={
          <ProtectedRoute>
            <Layout user={user} onLogout={handleLogout}>
              <Classes />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
