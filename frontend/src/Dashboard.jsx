import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, Cpu, Activity, Upload, Video, Camera,
  Info, Shield, Eye, Fingerprint, AlertTriangle, Download, LogOut,
  User, CheckCircle, XCircle, Clock, BarChart2, Zap, ChevronRight
} from 'lucide-react';

const API = "http://localhost:8000";
const MODES = { LIVE: 'live', PHOTO: 'photo', VIDEO: 'video' };

export default function Dashboard({ user, onLogout }) {
  const webcamRef = useRef(null);
  const [mode, setMode] = useState(MODES.LIVE);
  const [result, setResult] = useState(null);
  const [liveActive, setLiveActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploadedPreview, setUploadedPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState(null);
  const loopRef = useRef(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Live scan loop
  useEffect(() => {
    loopRef.current = liveActive && mode === MODES.LIVE;
    if (loopRef.current) {
      const run = async () => {
        if (!loopRef.current) return;
        await captureFrame();
        if (loopRef.current) setTimeout(run, 500);
      };
      run();
    }
    return () => { loopRef.current = false; };
  }, [liveActive, mode]);

  const pushHistory = (r) => {
    if (r?.status === 'success') {
      setHistory(prev => [{
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isReal: r.is_real,
        conf: r.confidence,
        threat: r.threat_level,
        label: r.label,
        mode
      }, ...prev].slice(0, 8));
    }
  };

  const captureFrame = async () => {
    if (!webcamRef.current || isLoading) return;
    const img = webcamRef.current.getScreenshot();
    if (!img) return;
    setIsLoading(true);
    try {
      const { data } = await axios.post(`${API}/analyze`, { image: img });
      setResult(data);
      pushHistory(data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadedPreview(URL.createObjectURL(file));
    setIsLoading(true);
    setResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await axios.post(`${API}/detect-ai-image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      if (data.status === 'success') data.is_real = !data.is_ai;
      setResult(data);
      pushHistory(data);
    } catch (e) {
      showToast('Analysis failed. Please try again.', 'error');
    }
    finally { setIsLoading(false); }
  };

  const handleVideoUpload = async (file) => {
    if (!file) return;
    setUploadedPreview(URL.createObjectURL(file));
    setIsLoading(true);
    setResult(null);
    setVideoProgress(0);
    const form = new FormData();
    form.append('file', file);
    const interval = setInterval(() => setVideoProgress(p => Math.min(p + 3, 88)), 800);
    try {
      const { data } = await axios.post(`${API}/detect-ai-video`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000
      });
      if (data.status === 'success') data.is_real = !data.is_ai;
      setResult(data);
      setVideoProgress(100);
      pushHistory(data);
    } catch (e) {
      showToast('Video analysis failed. Please try again.', 'error');
    }
    finally { setIsLoading(false); clearInterval(interval); }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (mode === MODES.PHOTO) handlePhotoUpload(file);
    else if (mode === MODES.VIDEO) handleVideoUpload(file);
  }, [mode]);

  const switchMode = (m) => {
    setMode(m); setResult(null); setUploadedPreview(null);
    setLiveActive(false); setVideoProgress(0);
  };

  const exportResult = () => {
    if (!result || result.status !== 'success') return;
    const report = {
      exported_at: new Date().toLocaleString(),
      mode,
      verdict: result.label,
      threat_level: result.threat_level,
      confidence_pct: (result.confidence * 100).toFixed(2) + '%',
      is_authentic: result.is_real,
      reasons: result.reasons,
      telemetry: result.meta,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truthlens_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Report exported!', 'success');
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('tl_token');
      if (token) await axios.post(`${API}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {}
    localStorage.removeItem('tl_token');
    localStorage.removeItem('tl_user');
    onLogout();
  };

  // Colors
  const isAuthentic = result?.is_real;
  const isAiMode = mode === MODES.PHOTO || mode === MODES.VIDEO;
  const threatColor = (t) => {
    if (!t) return '#94a3b8';
    const upper = t.toUpperCase();
    if (upper === 'VERIFIED' || upper === 'AUTHENTIC') return '#10b981';
    if (upper === 'SUSPICIOUS') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="bg-grid" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            className={`toast ${toast.type}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 12px rgba(15,23,42,0.06)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(79,70,229,0.25)'
          }}>
            <Fingerprint size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1 }}>
              TruthLens <span style={{ color: '#4f46e5' }}>PRO</span>
            </h1>
            <p style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Biometric Intelligence
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div style={{
          display: 'flex', gap: '4px', padding: '4px',
          background: '#f0f4ff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          {[
            { id: MODES.LIVE, icon: Camera, label: 'Live Scan' },
            { id: MODES.PHOTO, icon: Upload, label: 'Photo' },
            { id: MODES.VIDEO, icon: Video, label: 'Video' },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => switchMode(id)} className={`mode-tab ${mode === id ? 'active' : ''}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* User + Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: liveActive || isLoading ? '#10b981' : '#94a3b8',
              animation: (liveActive || isLoading) ? 'pulse-dot 2s infinite' : 'none',
              boxShadow: (liveActive || isLoading) ? '0 0 8px rgba(16,185,129,0.5)' : 'none'
            }} />
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '0.05em' }}>
              {isLoading ? 'ANALYZING' : liveActive ? 'LIVE' : 'STANDBY'}
            </span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 12px',
            background: '#f8faff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px'
          }}>
            <div style={{
              width: '28px', height: '28px',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <User size={14} color="white" />
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{user.name}</span>
          </div>

          <button onClick={handleLogout} className="btn btn-ghost"
            style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      {/* ─── Main Dashboard ──────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '260px 1fr 300px',
        gap: '20px',
        padding: '20px 24px',
        maxWidth: '1600px',
        margin: '0 auto',
        width: '100%',
        alignItems: 'start',
        minHeight: 'calc(100vh - 70px)'
      }}>

        {/* ─── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* System Metrics */}
          <div className="card" style={{ padding: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>
              System Metrics
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {[
                { label: 'Inference Engine', value: result?.meta?.engine || 'Awaiting...', icon: <Cpu size={13} /> },
                { label: 'Processing Latency', value: result?.meta?.inference_ms ? `${Math.round(result.meta.inference_ms)} ms` : '— ms', icon: <Activity size={13} />, highlight: true },
                { label: '3D Head Pose', value: result?.meta?.pose_3d ? `P:${Math.round(result.meta.pose_3d.pitch)}° Y:${Math.round(result.meta.pose_3d.yaw)}°` : 'Awaiting...', icon: <Eye size={13} /> },
                { label: 'FFT Frequency', value: result?.meta?.frequency_fft ? `${result.meta.frequency_fft}` : '—', icon: <BarChart2 size={13} /> },
              ].map((m, i) => (
                <div key={i} className="stat-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '11px' }}>
                    {m.icon}
                    <span>{m.label}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: m.highlight ? '#4f46e5' : '#374151' }}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Neural Activity */}
          <div className="card" style={{ padding: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>
              Neural Activity
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '56px', gap: '2px' }}>
              {[...Array(24)].map((_, i) => (
                <motion.div key={i}
                  style={{ flex: 1, background: 'linear-gradient(to top, #4f46e5, #818cf8)', borderRadius: '2px 2px 0 0', minWidth: '3px' }}
                  animate={{ height: (liveActive || isLoading) ? `${20 + Math.random() * 80}%` : '8%' }}
                  transition={{ duration: 0.35, repeat: Infinity, repeatType: 'reverse', delay: i * 0.035 }}
                />
              ))}
            </div>
            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '10px', fontFamily: 'monospace' }}>
              {liveActive ? 'STREAMING · MODEL:ACTIVE' : 'STANDBY · MODEL:READY'}
            </p>
          </div>

          {/* Scan History */}
          <div className="card" style={{ padding: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>
              Recent Scans
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.length ? history.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: '#f8faff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: h.isReal ? '#10b981' : '#ef4444'
                    }} />
                    <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>{h.time}</span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: threatColor(h.threat) }}>{h.threat}</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>{(h.conf * 100).toFixed(0)}%</span>
                </div>
              )) : (
                <div style={{
                  padding: '20px', textAlign: 'center',
                  border: '1px dashed #e2e8f0', borderRadius: '8px',
                  color: '#94a3b8', fontSize: '11px'
                }}>
                  No scans yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── CENTER PANEL ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* LIVE MODE */}
          {mode === MODES.LIVE && (
            <div className="card" style={{ overflow: 'hidden' }}>
              {/* Header bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: liveActive ? '#10b981' : '#94a3b8',
                    animation: liveActive ? 'pulse-dot 2s infinite' : 'none'
                  }} />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#374151', letterSpacing: '0.05em' }}>
                    {liveActive ? '● LIVE SCAN ACTIVE' : 'CAMERA STANDBY'}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Anti-Spoof Liveness Detection
                </span>
              </div>

              {/* Webcam */}
              <div style={{ position: 'relative', background: '#0f172a' }}>
                {!liveActive && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)'
                  }}>
                    <div style={{
                      width: '72px', height: '72px',
                      background: 'rgba(79,70,229,0.15)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '16px',
                      border: '2px solid rgba(79,70,229,0.3)'
                    }}>
                      <Camera size={32} color="#6366f1" />
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: '600' }}>
                      Click below to start live scan
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '6px' }}>
                      Real-time face liveness detection
                    </p>
                  </div>
                )}

                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  style={{ width: '100%', display: 'block', maxHeight: '380px', objectFit: 'cover', opacity: liveActive ? 1 : 0.15 }}
                  videoConstraints={{ facingMode: 'user', width: 640, height: 380 }}
                />

                {liveActive && <div className="scanner-line" />}

                {/* Face box overlay */}
                {result?.status === 'success' && result.bbox && liveActive && (
                  <div style={{
                    position: 'absolute',
                    left: `${result.bbox.x}px`,
                    top: `${result.bbox.y}px`,
                    width: `${result.bbox.w}px`,
                    height: `${result.bbox.h}px`,
                    pointerEvents: 'none'
                  }}>
                    {/* Corners */}
                    {[
                      { top: 0, left: 0, borderTop: true, borderLeft: true },
                      { top: 0, right: 0, borderTop: true, borderRight: true },
                      { bottom: 0, left: 0, borderBottom: true, borderLeft: true },
                      { bottom: 0, right: 0, borderBottom: true, borderRight: true },
                    ].map((pos, i) => (
                      <div key={i} style={{
                        position: 'absolute', width: '20px', height: '20px',
                        ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
                        ...(pos.left !== undefined ? { left: pos.left } : { right: pos.right }),
                        borderTop: pos.borderTop ? `2px solid ${isAuthentic ? '#10b981' : '#ef4444'}` : 'none',
                        borderLeft: pos.borderLeft ? `2px solid ${isAuthentic ? '#10b981' : '#ef4444'}` : 'none',
                        borderBottom: pos.borderBottom ? `2px solid ${isAuthentic ? '#10b981' : '#ef4444'}` : 'none',
                        borderRight: pos.borderRight ? `2px solid ${isAuthentic ? '#10b981' : '#ef4444'}` : 'none',
                      }} />
                    ))}
                    <div style={{
                      position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)',
                      padding: '3px 10px', borderRadius: '20px',
                      background: isAuthentic ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      border: `1px solid ${isAuthentic ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      color: isAuthentic ? '#10b981' : '#ef4444',
                      fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap',
                      backdropFilter: 'blur(10px)'
                    }}>
                      {result.label}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 18px' }}>
                <button
                  onClick={() => setLiveActive(v => !v)}
                  className={`btn ${liveActive ? 'btn-danger' : 'btn-primary'}`}
                  style={{ width: '100%', padding: '12px', fontSize: '13px', letterSpacing: '0.05em' }}
                >
                  {liveActive ? (
                    <><XCircle size={15} /> Stop Live Scan</>
                  ) : (
                    <><Zap size={15} /> Initialize Live Scan</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* PHOTO MODE */}
          {mode === MODES.PHOTO && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                style={{
                  minHeight: '420px', position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '32px'
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !isLoading && document.getElementById('photo-input').click()}
              >
                <input id="photo-input" type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => handlePhotoUpload(e.target.files[0])} />

                {uploadedPreview ? (
                  <img src={uploadedPreview} style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '12px' }} alt="Uploaded" />
                ) : (
                  <>
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        width: '80px', height: '80px',
                        background: 'linear-gradient(135deg, #f0f4ff, #e8ecff)',
                        borderRadius: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '20px',
                        border: '2px solid #e2e8f0',
                        boxShadow: '0 8px 24px rgba(79,70,229,0.1)'
                      }}
                    >
                      <Upload size={36} color="#4f46e5" />
                    </motion.div>
                    <p style={{ fontWeight: '800', color: '#1e293b', fontSize: '18px', marginBottom: '8px' }}>
                      Drop your image here
                    </p>
                    <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px' }}>or <span style={{ color: '#4f46e5', fontWeight: '600' }}>click to browse</span> · JPG, PNG, WEBP</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {['GAN Detection', 'Diffusion Art', 'Real Photos', 'Deepfakes'].map(tag => (
                        <span key={tag} className="badge badge-primary" style={{ fontSize: '10px' }}>{tag}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '24px' }}>Powered by Vision Transformer · umm-maybe model</p>
                  </>
                )}

                {isLoading && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(248,250,255,0.95)', backdropFilter: 'blur(12px)',
                    borderRadius: '22px', gap: '12px'
                  }}>
                    <div style={{
                      width: '56px', height: '56px',
                      border: '3px solid #e2e8f0',
                      borderTopColor: '#4f46e5',
                      borderRadius: '50%',
                      animation: 'spin-slow 0.8s linear infinite'
                    }} />
                    <p style={{ fontWeight: '800', color: '#4f46e5', fontSize: '15px' }}>Analyzing image...</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>Running ViT model · first run downloads model</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIDEO MODE */}
          {mode === MODES.VIDEO && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                style={{
                  minHeight: '420px', position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '32px'
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !isLoading && document.getElementById('video-input').click()}
              >
                <input id="video-input" type="file" accept="video/*" style={{ display: 'none' }}
                  onChange={e => handleVideoUpload(e.target.files[0])} />

                {uploadedPreview ? (
                  <video src={uploadedPreview} style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '12px' }} controls />
                ) : (
                  <>
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        width: '80px', height: '80px',
                        background: 'linear-gradient(135deg, #f0f4ff, #e8ecff)',
                        borderRadius: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '20px',
                        border: '2px solid #e2e8f0',
                        boxShadow: '0 8px 24px rgba(79,70,229,0.1)'
                      }}
                    >
                      <Video size={36} color="#4f46e5" />
                    </motion.div>
                    <p style={{ fontWeight: '800', color: '#1e293b', fontSize: '18px', marginBottom: '8px' }}>
                      Drop your video here
                    </p>
                    <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px' }}>or <span style={{ color: '#4f46e5', fontWeight: '600' }}>click to browse</span> · MP4, MOV, AVI</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {['Frame Analysis', 'AI Video', 'Real Recordings', 'Deepfake Video'].map(tag => (
                        <span key={tag} className="badge badge-primary" style={{ fontSize: '10px' }}>{tag}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '24px' }}>Samples 12 frames/sec · ViT frame-by-frame analysis</p>
                  </>
                )}

                {isLoading && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(248,250,255,0.95)', backdropFilter: 'blur(12px)',
                    borderRadius: '22px', gap: '16px', padding: '32px'
                  }}>
                    <div style={{
                      width: '56px', height: '56px',
                      border: '3px solid #e2e8f0',
                      borderTopColor: '#4f46e5',
                      borderRadius: '50%',
                      animation: 'spin-slow 0.8s linear infinite'
                    }} />
                    <p style={{ fontWeight: '800', color: '#4f46e5', fontSize: '15px' }}>Analyzing video frames...</p>
                    <div style={{ width: '100%', maxWidth: '320px' }}>
                      <div className="confidence-bar-track" style={{ height: '10px' }}>
                        <div className="confidence-bar-fill gradient-primary"
                          style={{ width: `${videoProgress}%`, transition: 'width 0.5s ease' }} />
                      </div>
                      <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
                        {videoProgress}% complete · sampling frames...
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Frame chart */}
              {result?.frame_results && (
                <div className="card" style={{ padding: '18px' }}>
                  <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>
                    Frame-by-Frame Analysis · {result.frames_analyzed} samples
                  </p>
                  <div className="frame-chart">
                    {result.frame_results.map((f, i) => (
                      <div
                        key={i}
                        className="frame-bar"
                        data-tooltip={`F${f.frame}: ${(f.confidence * 100).toFixed(0)}%`}
                        style={{
                          height: `${Math.max(f.confidence * 100, 10)}%`,
                          background: (f.is_real !== undefined ? f.is_real : !f.is_ai)
                            ? 'linear-gradient(to top, #059669, #10b981)'
                            : 'linear-gradient(to top, #dc2626, #ef4444)'
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '600' }}>
                      ✓ {result.real_frames || 0} Authentic frames
                    </span>
                    <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '600' }}>
                      ✗ {result.ai_frames || 0} AI frames
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode Description Banner */}
          <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', minWidth: '36px',
              background: '#f0f4ff', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5'
            }}>
              {mode === MODES.LIVE ? <Camera size={16} /> : mode === MODES.PHOTO ? <Shield size={16} /> : <Activity size={16} />}
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>
                {mode === MODES.LIVE ? 'Anti-Spoof Liveness Detection' : mode === MODES.PHOTO ? 'AI Image Detection' : 'AI Video Detection'}
              </p>
              <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                {mode === MODES.LIVE
                  ? 'MiniFASNetV2 ONNX model · Real-time face anti-spoofing'
                  : mode === MODES.PHOTO
                  ? 'ViT model · Detects GAN, Diffusion, and AI-generated images'
                  : 'Frame-by-frame ViT analysis · AI video origin detection'}
              </p>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL — Results ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '20px' }}>
              Analysis Result
            </p>

            <AnimatePresence mode="wait">
              {result?.status === 'success' ? (
                <motion.div key="result"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  {/* Verdict Badge */}
                  <div style={{
                    marginBottom: '20px',
                    padding: '6px 18px',
                    borderRadius: '999px',
                    background: isAuthentic ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${isAuthentic ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    color: isAuthentic ? '#10b981' : '#ef4444',
                    fontSize: '11px', fontWeight: '800', letterSpacing: '0.1em'
                  }}>
                    {result.threat_level}
                  </div>

                  {/* Icon */}
                  <motion.div
                    initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    style={{
                      width: '80px', height: '80px',
                      background: isAuthentic ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '16px',
                      border: `2px solid ${isAuthentic ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      boxShadow: isAuthentic ? '0 8px 32px rgba(16,185,129,0.15)' : '0 8px 32px rgba(239,68,68,0.15)'
                    }}
                  >
                    {isAuthentic
                      ? <ShieldCheck size={40} color="#10b981" />
                      : <ShieldAlert size={40} color="#ef4444" />}
                  </motion.div>

                  {/* Score */}
                  <div style={{ fontSize: '52px', fontWeight: '800', letterSpacing: '-2px', color: '#0f172a', lineHeight: 1 }}>
                    {(result.confidence * 100).toFixed(1)}
                    <span style={{ fontSize: '22px', fontWeight: '400', color: '#94a3b8' }}>%</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '6px', marginBottom: '20px' }}>
                    Confidence Score
                  </p>

                  {/* Confidence Bar */}
                  <div style={{ width: '100%', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '600' }}>THREAT</span>
                      <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '600' }}>VERIFIED</span>
                    </div>
                    <div className="confidence-bar-track">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.confidence * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="confidence-bar-fill"
                        style={{
                          background: result.confidence > 0.75
                            ? 'linear-gradient(90deg, #059669, #10b981)'
                            : result.confidence > 0.5
                            ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                            : 'linear-gradient(90deg, #dc2626, #ef4444)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      {[0, 25, 50, 75, 100].map(v => (
                        <span key={v} style={{ fontSize: '9px', color: '#cbd5e1' }}>{v}%</span>
                      ))}
                    </div>
                  </div>

                  {/* Label */}
                  <div style={{
                    width: '100%', padding: '12px',
                    background: isAuthentic ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${isAuthentic ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                    borderRadius: '10px',
                    textAlign: 'center',
                    marginBottom: '16px'
                  }}>
                    <p style={{
                      fontSize: '16px', fontWeight: '800',
                      color: isAuthentic ? '#10b981' : '#ef4444',
                      letterSpacing: '0.05em'
                    }}>
                      {result.label}
                    </p>
                  </div>

                  {/* Frames info for video */}
                  {result.frames_analyzed && (
                    <div style={{
                      width: '100%', padding: '10px 14px',
                      background: '#f8faff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'flex', justifyContent: 'space-between',
                      marginBottom: '16px'
                    }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Frames Analyzed</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>{result.frames_analyzed}</span>
                    </div>
                  )}

                  {/* Reasons */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {result.reasons?.map((r, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        padding: '10px 12px',
                        background: '#f8faff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <ChevronRight size={12} style={{ color: '#4f46e5', marginTop: '2px', minWidth: '12px' }} />
                        <p style={{ fontSize: '11px', color: '#475569', lineHeight: '1.5' }}>{r}</p>
                      </div>
                    ))}
                  </div>

                  {/* Export */}
                  <button onClick={exportResult} className="btn btn-ghost"
                    style={{ width: '100%', marginTop: '16px', fontSize: '12px' }}>
                    <Download size={13} /> Export Report
                  </button>
                </motion.div>

              ) : result?.status === 'error' ? (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ textAlign: 'center', padding: '32px 0' }}>
                  <AlertTriangle size={40} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '13px', color: '#ef4444', fontWeight: '500' }}>{result.message}</p>
                </motion.div>

              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{
                    width: '72px', height: '72px',
                    background: '#f0f4ff',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                    border: '2px dashed #e2e8f0'
                  }}>
                    <Shield size={32} color="#c7d2fe" />
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>
                    {mode === MODES.LIVE ? 'Start live scan to analyze' :
                      mode === MODES.PHOTO ? 'Upload a photo to detect AI' :
                        'Upload a video to analyze'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px' }}>
                    Results will appear here
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Info Card */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Detection Models
            </p>
            {[
              { label: 'Liveness', model: 'MiniFASNetV2 ONNX', active: mode === MODES.LIVE },
              { label: 'AI Image', model: 'ViT umm-maybe', active: mode === MODES.PHOTO },
              { label: 'AI Video', model: 'ViT frame-sampling', active: mode === MODES.VIDEO },
            ].map((m, i) => (
              <div key={i} className="stat-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: m.active ? '#10b981' : '#e2e8f0'
                  }} />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{m.label}</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '600', color: m.active ? '#4f46e5' : '#94a3b8', fontFamily: 'monospace' }}>{m.model}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '12px 28px',
        borderTop: '1px solid #e2e8f0',
        background: 'rgba(255,255,255,0.8)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
          TruthLens PRO v3.0 · Built by <strong style={{ color: '#4f46e5' }}>Prasan</strong>
        </p>
        <p style={{ fontSize: '11px', color: '#cbd5e1', fontFamily: 'monospace' }}>
          FastAPI · ONNX · ViT · YuNet · React
        </p>
      </footer>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
