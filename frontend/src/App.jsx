import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Cpu, Activity, Upload, Video, Camera, Info, Shield, Eye, Fingerprint, Settings, AlertTriangle, Download } from 'lucide-react';

const API = "http://localhost:8000";

const MODES = { LIVE: 'live', PHOTO: 'photo', VIDEO: 'video' };

export default function App() {
  const webcamRef = useRef(null);
  const videoRef = useRef(null);
  const [mode, setMode] = useState(MODES.LIVE);
  const [result, setResult] = useState(null);
  const [liveActive, setLiveActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploadedPreview, setUploadedPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const loopRef = useRef(false);
  const dashboardRef = useRef(null);

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
  };

  // Live scan loop
  useEffect(() => {
    loopRef.current = liveActive && mode === MODES.LIVE;
    if (loopRef.current) {
      const run = async () => {
        if (!loopRef.current) return;
        await captureFrame();
        if (loopRef.current) setTimeout(run, 400);
      };
      run();
    }
    return () => { loopRef.current = false; };
  }, [liveActive, mode]);

  const pushHistory = (r) => {
    if (r?.status === 'success') {
      setHistory(prev => [{
        time: new Date().toLocaleTimeString(),
        isReal: r.is_real,
        conf: r.confidence,
        threat: r.threat_level
      }, ...prev].slice(0, 6));
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
      // Uses AI-generation detection model (HuggingFace)
      const { data } = await axios.post(`${API}/detect-ai-image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });
      // Normalize for display (is_real = not is_ai)
      if (data.status === 'success') data.is_real = !data.is_ai;
      setResult(data);
      pushHistory(data);
    } catch (e) { console.error(e); }
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
    const interval = setInterval(() => setVideoProgress(p => Math.min(p + 4, 88)), 600);
    try {
      // Uses AI-generation detection model (HuggingFace) on sampled frames
      const { data } = await axios.post(`${API}/detect-ai-video`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000
      });
      if (data.status === 'success') data.is_real = !data.is_ai;
      setResult(data);
      setVideoProgress(100);
      pushHistory(data);
    } catch (e) { console.error(e); }
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

  const threatColor = (t) => {
    if (t === 'VERIFIED') return 'text-[#00ff88]';
    if (t === 'SUSPICIOUS') return 'text-yellow-400';
    return 'text-red-500';
  };
  const threatBg = (t) => {
    if (t === 'VERIFIED') return 'bg-[#00ff88]/10 border-[#00ff88]/30';
    if (t === 'SUSPICIOUS') return 'bg-yellow-400/10 border-yellow-400/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="min-h-screen bg-[#030507] text-white flex flex-col overflow-hidden">
      {/* Ambient Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[45%] h-[45%] bg-[#00ff88] rounded-full blur-[160px] opacity-[0.03] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[45%] h-[45%] bg-[#00d4ff] rounded-full blur-[160px] opacity-[0.03] pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center px-8 py-5 border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#00ff88]/10 rounded-xl border border-[#00ff88]/20">
            <Fingerprint className="text-[#00ff88]" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              TRUTHLENS
              <span className="px-2 py-0.5 text-xs bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 rounded font-bold tracking-widest">PRO</span>
            </h1>
            <p className="text-[9px] text-white/30 tracking-[0.3em]">ADVANCED BIOMETRIC AUTHENTICATION</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          {[
            { id: MODES.LIVE, icon: Camera, label: 'LIVE' },
            { id: MODES.PHOTO, icon: Upload, label: 'PHOTO' },
            { id: MODES.VIDEO, icon: Video, label: 'VIDEO' },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => switchMode(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs tracking-widest transition-all
                ${mode === id ? 'bg-[#00ff88] text-black shadow-lg shadow-[#00ff88]/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${liveActive || isLoading ? 'bg-[#00ff88] animate-pulse' : 'bg-white/20'}`} />
          <span className="text-xs tracking-widest text-white/40">{isLoading ? 'ANALYZING' : liveActive ? 'ACTIVE' : 'STANDBY'}</span>
          <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10">
            <Settings size={16} className="text-white/40" />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 grid grid-cols-12 gap-6 p-6 max-w-[1600px] mx-auto w-full">

        {/* LEFT PANEL */}
        <div className="col-span-3 flex flex-col gap-5">
          <div className="p-5 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-xl">
            <p className="text-[9px] text-white/30 tracking-[0.2em] mb-5">SYSTEM METRICS</p>
            <div className="space-y-5">
              <Metric label="Inference Engine" value={result?.meta?.engine || 'Awaiting...'} icon={<Cpu size={12}/>} />
              <Metric label="Processing Latency"
                value={result?.meta?.inference_ms ? `${Math.round(result.meta.inference_ms)} ms` : '-- ms'}
                icon={<Activity size={12}/>}
                highlight />
              <Metric label="3D Head Pose"
                value={result?.meta?.pose_3d
                  ? `P:${Math.round(result.meta.pose_3d.pitch)}° Y:${Math.round(result.meta.pose_3d.yaw)}° R:${Math.round(result.meta.pose_3d.roll)}°`
                  : 'Awaiting...'}
                icon={<Eye size={12}/>} />
              <Metric label="FFT Frequency"
                value={result?.meta?.frequency_fft ? `${result.meta.frequency_fft}` : '--'}
                icon={<Activity size={12}/>} />
            </div>
          </div>

          {/* Neural Activity */}
          <div className="p-5 rounded-2xl bg-black/40 border border-white/5 flex-1">
            <p className="text-[9px] text-white/30 tracking-[0.2em] mb-4">NEURAL ACTIVITY</p>
            <div className="flex items-end h-14 gap-0.5">
              {[...Array(20)].map((_, i) => (
                <motion.div key={i}
                  className="flex-1 bg-[#00ff88]/25 rounded-t-sm"
                  animate={{ height: (liveActive || isLoading) ? `${Math.random() * 100}%` : '5%' }}
                  transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse', delay: i * 0.04 }}
                />
              ))}
            </div>
            <p className="text-[9px] text-white/15 mt-5 leading-relaxed font-mono">
              ENC:CH722 // STREAMING<br />
              BUFFER:1024KB // MODEL:OK
            </p>
          </div>
        </div>

        {/* CENTER PANEL */}
        <div className="col-span-6 flex flex-col gap-5">

          {/* Live Mode */}
          {mode === MODES.LIVE && (
            <div className="rounded-2xl overflow-hidden bg-black border border-white/5 relative flex-1 flex flex-col">
              <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-full bg-black/70 border border-white/10 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${liveActive ? 'bg-[#00ff88] animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[9px] font-bold tracking-widest">{liveActive ? 'LIVE' : 'OFFLINE'}</span>
              </div>

              {!liveActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-white/20 pointer-events-none">
                  <Eye size={56} strokeWidth={1} className="mb-3 opacity-40" />
                  <p className="text-xs tracking-widest">CLICK BUTTON BELOW TO START</p>
                </div>
              )}

              <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                className={`w-full flex-1 object-cover transition-opacity ${liveActive ? 'opacity-100' : 'opacity-10'}`}
                style={{ minHeight: '300px' }}
                videoConstraints={{ facingMode: 'user' }} />

              {liveActive && <div className="scanner-line" />}

              {/* Bounding Box */}
              {result?.status === 'success' && result.bbox && liveActive && (
                <motion.div animate={{ x: result.bbox.x, y: result.bbox.y, width: result.bbox.w, height: result.bbox.h }}
                  className="absolute" style={{ transition: 'all 0.15s ease' }}>
                  {['top-0 left-0 border-t-2 border-l-2','top-0 right-0 border-t-2 border-r-2','bottom-0 left-0 border-b-2 border-l-2','bottom-0 right-0 border-b-2 border-r-2']
                    .map((c, i) => <div key={i} className={`absolute w-6 h-6 ${c} ${result.is_real ? 'border-[#00ff88]' : 'border-red-500'}`} />)}
                  <div className={`absolute inset-0 ${result.is_real ? 'bg-[#00ff88]/5' : 'bg-red-500/10'}`} />
                  <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-bold border backdrop-blur-md
                    ${result.is_real ? 'text-[#00ff88] border-[#00ff88]/30 bg-[#00ff88]/10' : 'text-red-500 border-red-500/30 bg-red-500/10'}`}>
                    {result.label}
                  </div>
                </motion.div>
              )}

              <div className="p-4">
                <button onClick={() => setLiveActive(!liveActive)}
                  className={`w-full py-3 rounded-xl font-bold tracking-widest text-sm ${liveActive
                    ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                    : 'bg-[#00ff88] text-black'}`}>
                  {liveActive ? 'TERMINATE SCAN' : 'INITIALIZE LIVE SCAN'}
                </button>
              </div>
            </div>
          )}

          {/* Photo Mode */}
          {mode === MODES.PHOTO && (
            <div className="flex-1 flex flex-col gap-4">
              <div
                className={`rounded-2xl border-2 border-dashed transition-all ${dragOver ? 'border-[#00ff88] bg-[#00ff88]/5' : 'border-white/10 bg-black/40'} 
                  flex flex-col items-center justify-center h-64 cursor-pointer relative overflow-hidden`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('photo-input').click()}>
                <input id="photo-input" type="file" accept="image/*" className="hidden"
                  onChange={e => handlePhotoUpload(e.target.files[0])} />
                {uploadedPreview ? (
                  <img src={uploadedPreview} className="w-full h-full object-contain p-4" alt="Uploaded" />
                ) : (
                  <>
                    <Upload size={40} className="text-white/20 mb-3" strokeWidth={1} />
                    <p className="text-white/40 text-sm font-semibold">Drop photo here or click to upload</p>
                    <p className="text-white/20 text-xs mt-1">JPG, PNG, WEBP supported</p>
                  </>
                )}
                {isLoading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <div className="text-[#00ff88] text-sm font-bold tracking-widest animate-pulse">ANALYZING IMAGE...</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video Mode */}
          {mode === MODES.VIDEO && (
            <div className="flex-1 flex flex-col gap-4">
              <div
                className={`rounded-2xl border-2 border-dashed transition-all ${dragOver ? 'border-[#00ff88] bg-[#00ff88]/5' : 'border-white/10 bg-black/40'}
                  flex flex-col items-center justify-center h-64 cursor-pointer relative overflow-hidden`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !isLoading && document.getElementById('video-input').click()}>
                <input id="video-input" type="file" accept="video/*" className="hidden"
                  onChange={e => handleVideoUpload(e.target.files[0])} />
                {uploadedPreview ? (
                  <video src={uploadedPreview} className="w-full h-full object-contain p-2" controls />
                ) : (
                  <>
                    <Video size={40} className="text-white/20 mb-3" strokeWidth={1} />
                    <p className="text-white/40 text-sm font-semibold">Drop video here or click to upload</p>
                    <p className="text-white/20 text-xs mt-1">MP4, MOV, AVI supported</p>
                  </>
                )}
                {isLoading && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm gap-4 p-8">
                    <p className="text-[#00ff88] text-xs font-bold tracking-widest animate-pulse">ANALYZING VIDEO FRAMES...</p>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-[#00ff88] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${videoProgress}%` }} />
                    </div>
                    <p className="text-white/40 text-xs">{videoProgress}% complete</p>
                  </div>
                )}
              </div>

              {/* Per-frame chart for video results */}
              {result?.frame_results && (
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-[9px] text-white/30 tracking-widest mb-3">FRAME-BY-FRAME ANALYSIS ({result.frames_analyzed} samples)</p>
                  <div className="flex items-end h-16 gap-1">
                    {result.frame_results.map((f, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block text-[9px] bg-black/80 px-1 rounded text-white/60 whitespace-nowrap">
                          f{f.frame}: {(f.confidence*100).toFixed(0)}%
                        </div>
                        <div className={`w-full rounded-t-sm ${f.is_real ? 'bg-[#00ff88]/60' : 'bg-red-500/60'}`}
                          style={{ height: `${f.confidence * 100}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent Scans */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
            <p className="text-[9px] text-white/30 tracking-[0.2em] mb-3">RECENT SCANS</p>
            <div className="space-y-2">
              {history.length ? history.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-[9px] text-white/30 font-mono">{h.time}</span>
                  <span className={`text-[9px] font-bold ${threatColor(h.threat)}`}>{h.threat}</span>
                  <span className="text-xs font-bold text-white/60">{(h.conf * 100).toFixed(0)}%</span>
                  <div className={`w-2 h-2 rounded-full ${h.isReal ? 'bg-[#00ff88]' : 'bg-red-500'}`} />
                </div>
              )) : (
                <div className="h-10 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                  <span className="text-[9px] text-white/20 tracking-widest">NO HISTORY</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Assessment */}
        <div className="col-span-3 flex flex-col gap-5">
          <div className="p-6 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-xl flex-1">
            <p className="text-[9px] text-white/30 tracking-[0.2em] mb-5">BIOMETRIC ASSESSMENT</p>

            <AnimatePresence mode="wait">
              {result?.status === 'success' ? (
                <motion.div key="result"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center">

                  {/* Threat Badge */}
                  <div className={`mb-5 px-5 py-2 rounded-full border font-bold tracking-widest text-xs ${threatBg(result.threat_level)} ${threatColor(result.threat_level)}`}>
                    {result.threat_level}
                  </div>

                  {/* Big Icon */}
                  <div className={`p-5 rounded-full mb-4 ${result.is_real ? 'bg-[#00ff88]/10' : 'bg-red-500/10'}`}>
                    {result.is_real
                      ? <ShieldCheck size={44} className="text-[#00ff88]" />
                      : <ShieldAlert size={44} className="text-red-500" />}
                  </div>

                  <div className="text-5xl font-light mb-1">
                    {(result.confidence * 100).toFixed(1)}<span className="text-xl text-white/30">%</span>
                  </div>
                  <p className="text-[9px] text-white/30 tracking-widest mb-3">AUTHENTICITY CONFIDENCE</p>

                  {/* Confidence Gauge Bar */}
                  <div className="w-full mb-5">
                    <div className="flex justify-between text-[9px] text-white/30 mb-1.5">
                      <span>THREAT</span>
                      <span>VERIFIED</span>
                    </div>
                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.confidence * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          result.confidence > 0.75 ? 'bg-gradient-to-r from-[#00cc6a] to-[#00ff88]' :
                          result.confidence > 0.5 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                          'bg-gradient-to-r from-red-700 to-red-500'
                        }`}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      {[0,25,50,75,100].map(v => (
                        <span key={v} className="text-[8px] text-white/20">{v}%</span>
                      ))}
                    </div>
                  </div>

                  {result.frame_results && (
                    <div className="w-full mb-4 p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                      <p className="text-xs text-white/50">
                        <span className="text-white font-bold">{result.frames_analyzed}</span> frames analyzed
                      </p>
                    </div>
                  )}

                  <div className="w-full space-y-2">
                    {result.reasons?.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                        <Info size={12} className={`mt-0.5 min-w-[12px] ${result.is_real ? 'text-[#00ff88]' : 'text-red-400'}`} />
                        <p className="text-[11px] text-white/70 leading-relaxed">{r}</p>
                      </div>
                    ))}
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={exportResult}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-xs font-bold tracking-widest text-white/50 hover:text-white"
                  >
                    <Download size={12} />
                    EXPORT REPORT
                  </button>
                </motion.div>
              ) : result?.status === 'error' ? (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center text-white/30 pt-8">
                  <AlertTriangle size={40} className="mb-3 text-yellow-500/50" strokeWidth={1} />
                  <p className="text-xs text-yellow-500/60">{result.message}</p>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center text-white/20 pt-8">
                  <Shield size={48} strokeWidth={1} className="mb-4 opacity-30" />
                  <p className="text-[9px] tracking-widest text-center">
                    {mode === MODES.LIVE ? 'CLICK INITIALIZE TO START' :
                     mode === MODES.PHOTO ? 'UPLOAD A PHOTO TO ANALYZE' :
                     'UPLOAD A VIDEO TO ANALYZE'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, icon, highlight }) {
  return (
    <div>
      <p className="text-[9px] text-white/30 uppercase mb-1 flex items-center gap-1.5">{icon} {label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-[#00ff88]' : 'text-white/80'}`}>{value}</p>
    </div>
  );
}
