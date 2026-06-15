import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

const API = "http://localhost:8000";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // Restore session from localStorage on app start
  useEffect(() => {
    const token = localStorage.getItem('tl_token');
    const storedUser = localStorage.getItem('tl_user');
    if (token && storedUser) {
      // Quick session validation
      axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(({ data }) => {
          if (data.status === 'success') {
            setUser({ ...JSON.parse(storedUser), token });
          } else {
            localStorage.removeItem('tl_token');
            localStorage.removeItem('tl_user');
          }
        })
        .catch(() => {
          // If server is down or token invalid, still restore local user
          // so user doesn't get logged out on server restart
          try {
            setUser({ ...JSON.parse(storedUser), token });
          } catch {
            localStorage.removeItem('tl_token');
            localStorage.removeItem('tl_user');
          }
        })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  // Loading screen while checking session
  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f0f4ff'
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
        }}>
          <div style={{
            width: '48px', height: '48px',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(79,70,229,0.3)'
          }}>
            <span style={{ fontSize: '22px' }}>🔍</span>
          </div>
          <div style={{
            width: '32px', height: '32px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#4f46e5',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>
            Loading TruthLens PRO...
          </p>
        </div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
