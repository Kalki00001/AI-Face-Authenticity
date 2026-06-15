import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Eye, EyeOff, Fingerprint, Shield, Sparkles, Zap } from 'lucide-react';

const API = "http://localhost:8000";

export default function LoginPage({ onLogin }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const payload = tab === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const { data } = await axios.post(`${API}${endpoint}`, payload);
      if (data.status === 'success') {
        localStorage.setItem('tl_token', data.token);
        localStorage.setItem('tl_user', JSON.stringify({ name: data.name, email: data.email }));
        onLogin({ name: data.name, email: data.email, token: data.token });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-grid" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient blobs */}
      <div style={{
        position: 'fixed', top: '-10%', left: '-5%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed', bottom: '-10%', right: '-5%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', gap: '60px', alignItems: 'center' }}>

        {/* Left — Brand */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          style={{ flex: 1, display: 'none' }}
          className="brand-left"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
            <div style={{
              width: '56px', height: '56px',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(79,70,229,0.3)'
            }}>
              <Fingerprint size={28} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
                TruthLens <span style={{ color: '#4f46e5' }}>PRO</span>
              </h1>
              <p style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '2px' }}>
                Advanced Biometric Intelligence
              </p>
            </div>
          </div>

          <h2 style={{ fontSize: '42px', fontWeight: '800', lineHeight: '1.2', color: '#0f172a', marginBottom: '20px' }}>
            Detect AI.<br />
            <span style={{ background: 'linear-gradient(135deg, #4f46e5, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Verify Reality.
            </span>
          </h2>

          <p style={{ fontSize: '16px', color: '#64748b', lineHeight: '1.7', marginBottom: '40px', maxWidth: '380px' }}>
            State-of-the-art AI detection powered by Vision Transformers and ONNX neural networks. Analyze images, videos, and live streams instantly.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { icon: <Shield size={18} />, title: 'Anti-Spoof Liveness', desc: 'Real-time deepfake & spoof detection' },
              { icon: <Zap size={18} />, title: 'AI Image Detection', desc: 'GAN, Diffusion & other AI artifacts' },
              { icon: <Sparkles size={18} />, title: 'Video Frame Analysis', desc: 'Frame-by-frame authenticity scoring' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.7)',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div style={{
                  width: '38px', height: '38px', minWidth: '38px',
                  background: 'rgba(79,70,229,0.1)',
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#4f46e5'
                }}>
                  {f.icon}
                </div>
                <div>
                  <p style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{f.title}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right — Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ flex: '0 0 auto', width: '100%', maxWidth: '440px', margin: '0 auto' }}
        >
          {/* Logo (mobile / center when brand hidden) */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '64px', height: '64px',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              borderRadius: '20px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(79,70,229,0.3)',
              marginBottom: '16px'
            }}>
              <Fingerprint size={32} color="white" />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
              TruthLens <span style={{ color: '#4f46e5' }}>PRO</span>
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>AI Deepfake & Authenticity Platform</p>
          </div>

          <div className="auth-card">
            {/* Tab Switcher */}
            <div style={{
              display: 'flex', gap: '4px', marginBottom: '28px',
              background: '#f8faff', borderRadius: '10px', padding: '4px'
            }}>
              {['login', 'register'].map(t => (
                <button key={t} className={`auth-tab ${tab === t ? 'active' : ''}`}
                  onClick={() => { setTab(t); setError(''); setForm({ name: '', email: '', password: '' }); }}>
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.form
                key={tab}
                initial={{ opacity: 0, x: tab === 'login' ? -15 : 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                {tab === 'register' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      Full Name
                    </label>
                    <input
                      className="input-field"
                      type="text"
                      name="name"
                      placeholder="John Doe"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    className="input-field"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input-field"
                      type={showPass ? 'text' : 'password'}
                      name="password"
                      placeholder={tab === 'register' ? 'Min. 6 characters' : '••••••••'}
                      value={form.password}
                      onChange={handleChange}
                      required
                      style={{ paddingRight: '48px' }}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      style={{
                        position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px'
                      }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#ef4444',
                    }}
                  >
                    {error}
                  </motion.div>
                )}

                <button type="submit" className="btn btn-primary"
                  style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px' }}
                  disabled={loading}
                >
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        animation: 'spin-slow 0.8s linear infinite',
                        display: 'inline-block'
                      }} />
                      {tab === 'login' ? 'Signing in...' : 'Creating account...'}
                    </span>
                  ) : (
                    tab === 'login' ? 'Sign In to TruthLens' : 'Create Account'
                  )}
                </button>

                <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  {tab === 'login'
                    ? "Don't have an account? "
                    : "Already have an account? "}
                  <button type="button"
                    onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
                  >
                    {tab === 'login' ? 'Register here' : 'Sign in'}
                  </button>
                </p>
              </motion.form>
            </AnimatePresence>
          </div>

          <p style={{ textAlign: 'center', fontSize: '11px', color: '#cbd5e1', marginTop: '24px' }}>
            TruthLens PRO v3.0 · Built by <strong style={{ color: '#94a3b8' }}>Prasan</strong>
          </p>
        </motion.div>

      </div>

      <style>{`
        @media (min-width: 900px) {
          .brand-left { display: block !important; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
