'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type ContentBand = { overall?: number; taskResponse?: number; coherence?: number; vocabulary?: number; grammar?: number; };
type SpeechBand  = { overall?: number; pronunciation?: number; fluency?: number; };
type DualResp = {
  ok: boolean;
  data?: {
    transcript: string;
    content: { band: ContentBand; suggestions: string[] };
    speech:  { band: SpeechBand; metrics: { durationSec: number; wpm: number; pauseRate: number | null; avgPauseSec: number | null }; suggestions: string[] };
    tokensUsed?: number;
  };
  error?: { code: string; message: string };
  requestId?: string;
};

export default function SpeakingPage() {
  const routeParams = useParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(routeParams?.id) ? routeParams?.id?.[0] : routeParams?.id || '1';

  const [status, setStatus] = useState<'idle'|'recording'|'stopped'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [limitSec, setLimitSec] = useState(120);
  const [error, setError] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [resp, setResp] = useState<DualResp['data']>();
  const [loadingEval, setLoadingEval] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // 靜音偵測
  const silenceMsRef = useRef(0);
  const silenceSegmentCountRef = useRef(0);
  const inSilenceRef = useRef(false);
  const lastFrameTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'recording') return;
    if (seconds >= limitSec) { stopRecording(); return; }
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [status, seconds, limitSec]);

  useEffect(() => () => cleanupAll(), []);

  async function startRecording() {
    try {
      setError(''); setResp(undefined); setBlob(null); setAudioUrl(''); setSeconds(0); resetSilenceMetrics();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
      analyserRef.current = analyser;
      sourceRef.current = ctx.createMediaStreamSource(stream);
      sourceRef.current.connect(analyser);

      drawWaveformAndDetectSilence();

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlob(b); setAudioUrl(URL.createObjectURL(b));
      };
      recorder.start(200);
      setStatus('recording');
    } catch (e: any) {
      setError(e?.message || '無法啟用麥克風，請檢查瀏覽器權限。');
    }
  }
  function stopRecording() {
    try { mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop(); } catch {}
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}
    sourceRef.current = null;
    try { analyserRef.current?.disconnect(); } catch {}
    analyserRef.current = null;
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setStatus('stopped');
  }
  function cleanupAll() {
    stopRecording();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }
  function resetSilenceMetrics() {
    silenceMsRef.current = 0; silenceSegmentCountRef.current = 0; inSilenceRef.current = false; lastFrameTsRef.current = null;
  }

  function drawWaveformAndDetectSilence() {
    const analyser = analyserRef.current, canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const threshold = 0.02;   // 靜音門檻
    const minSilenceMs = 250; // 定義停頓

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      // 畫波形
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(24,24,27,0.85)';
      ctx.beginPath();
      const w = canvas.width, h = canvas.height, slice = w / bufferLength;
      let x = 0, rmsSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128; rmsSum += v*v;
        const y = (v * h) / 2 + h / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.lineTo(w, h/2); ctx.stroke();

      // 靜音偵測（RMS）
      const rms = Math.sqrt(rmsSum / bufferLength);
      const ts = now;
      if (lastFrameTsRef.current == null) lastFrameTsRef.current = ts;

      if (rms < threshold) {
        if (!inSilenceRef.current) { inSilenceRef.current = true; lastFrameTsRef.current = ts; }
        else { const elapsed = ts - (lastFrameTsRef.current || ts); lastFrameTsRef.current = ts; silenceMsRef.current += elapsed; }
      } else {
        if (inSilenceRef.current) {
          if ((ts - (lastFrameTsRef.current || ts)) >= minSilenceMs) silenceSegmentCountRef.current += 1;
        }
        inSilenceRef.current = false; lastFrameTsRef.current = ts;
      }
    };
    requestAnimationFrame(draw);
  }

  async function evaluate() {
    if (!blob) { setError('請先錄音再送出評測。'); return; }
    setLoadingEval(true); setResp(undefined); setError('');
    try {
      const base64 = await blobToBase64(blob);
      const payload = {
        taskId,
        audioBase64: base64,
        mime: blob.type || 'audio/webm',
        durationSec: seconds,
        manualTranscript,
        speechMetrics: calcSpeechMetrics(),
      };
      const res = await fetch('/api/speaking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json: DualResp = await res.json();
      if (!json.ok) throw new Error(json.error?.message || '評測失敗，稍後再試');
      setResp(json.data);
      if (!manualTranscript && json.data?.transcript) setManualTranscript(json.data.transcript);
    } catch (e: any) {
      setError(e?.message || '發生未預期錯誤');
    } finally {
      setLoadingEval(false);
    }
  }

  function calcSpeechMetrics() {
    const totalSilenceMs = silenceMsRef.current;
    const totalMs = seconds * 1000;
    const pauseRate = totalMs > 0 ? Math.min(1, Math.max(0, totalSilenceMs / totalMs)) : 0;
    const avgPauseSec = silenceSegmentCountRef.current > 0 ? Math.min(5, (totalSilenceMs / silenceSegmentCountRef.current) / 1000) : 0;
    return { pauseRate, avgPauseSec };
  }

  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  const remain = Math.max(0, limitSec - seconds);
  const rm = Math.floor(remain / 60);
  const rs = (remain % 60).toString().padStart(2, '0');

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] text-zinc-500 hover:text-zinc-800">← 回首頁</Link>
            <h1 className="text-[18px] font-medium tracking-tight">Speaking（Part 2）</h1>
          </div>
          <div className="text-[11px] text-zinc-500">Task #{taskId}</div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: Recorder */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] text-zinc-500">兩分鐘限時</div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1">
                  已錄 <span className="font-medium text-zinc-800">{m}:{s}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1">
                  剩餘 <span className="font-medium text-zinc-800">{rm}:{rs}</span>
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50">
              <canvas ref={canvasRef} className="h-28 w-full" width={800} height={140} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {status !== 'recording' && (
                <button onClick={startRecording}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 hover:bg-amber-100">
                  開始錄音
                </button>
              )}
              {status === 'recording' && (
                <button onClick={stopRecording}
                  className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900 hover:bg-red-100">
                  停止
                </button>
              )}
              <button onClick={() => { cleanupAll(); setStatus('idle'); setSeconds(0); setManualTranscript(''); setResp(undefined); resetSilenceMetrics(); }}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50">
                重置
              </button>

              <div className="ml-auto flex items-center gap-2">
                <label className="text-[12px] text-zinc-500">時長</label>
                <select className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px]"
                  value={limitSec} onChange={(e) => setLimitSec(Number(e.target.value))}>
                  <option value={60}>1 分鐘</option>
                  <option value={90}>1 分半</option>
                  <option value={120}>2 分鐘</option>
                </select>
              </div>
            </div>

            {audioUrl && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="text-[12px] text-zinc-500">錄音回放</div>
                <audio className="mt-2 w-full" controls src={audioUrl} />
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Right: Evaluate & Transcript */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-medium tracking-tight">AI 評測（雙通道）& 轉文字</h3>
              {!!resp?.tokensUsed && <span className="text-[11px] text-zinc-500">tokens {resp.tokensUsed}</span>}
            </div>

            <div className="mt-3">
              <label className="text-[12px] text-zinc-500">（可選）文字稿修正</label>
              <textarea
                className="mt-2 w-full min-h-[120px] rounded-xl border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="停止錄音後可先送出轉文字；若有錯字可在此修正再送評測。"
                value={manualTranscript}
                onChange={(e) => setManualTranscript(e.target.value)}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-[12px] text-zinc-500">音檔僅用於即時評測，不會長期儲存。</div>
              <button
                onClick={evaluate}
                disabled={!blob || loadingEval}
                className={[
                  'rounded-xl border px-4 py-2 text-sm transition-colors',
                  !blob || loadingEval
                    ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                    : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
                ].join(' ')}
              >
                {loadingEval ? '評測中…' : '送出評測'}
              </button>
            </div>

            {!resp && (
              <div className="mt-3 text-[13px] text-zinc-500">
                送出後會顯示兩組分數：內容面（TR/CC/LR/GRA）與語音面（Pronunciation/Fluency），並附上建議與 WPM/停頓指標。
              </div>
            )}

            {resp && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {/* Content channel */}
                <div className="rounded-xl border border-zinc-200 bg-white/70 p-4">
                  <div className="text-[12px] font-medium text-zinc-700">Content（內容面）</div>
                  <BandKV label="Overall" value={resp.content.band.overall} color="zinc" />
                  <BandKV label="Task Response" value={resp.content.band.taskResponse} />
                  <BandKV label="Coherence & Cohesion" value={resp.content.band.coherence} />
                  <BandKV label="Lexical Resource" value={resp.content.band.vocabulary} />
                  <BandKV label="Grammar Range & Accuracy" value={resp.content.band.grammar} />
                  {!!resp.content.suggestions?.length && (
                    <>
                      <div className="mt-3 text-[12px] font-medium text-zinc-700">建議</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-zinc-700">
                        {resp.content.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </>
                  )}
                </div>

                {/* Speech channel */}
                <div className="rounded-xl border border-zinc-200 bg-white/70 p-4">
                  <div className="text-[12px] font-medium text-zinc-700">Speech（語音面）</div>
                  <BandKV label="Overall" value={resp.speech.band.overall} color="amber" />
                  <BandKV label="Pronunciation" value={resp.speech.band.pronunciation} />
                  <BandKV label="Fluency" value={resp.speech.band.fluency} />

                  <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                    <Metric label="WPM" value={resp.speech.metrics.wpm ? `${resp.speech.metrics.wpm}` : '—'} />
                    <Metric label="PauseRate" value={resp.speech.metrics.pauseRate != null ? `${(resp.speech.metrics.pauseRate * 100).toFixed(1)}%` : '—'} />
                    <Metric label="AvgPause" value={resp.speech.metrics.avgPauseSec != null ? `${resp.speech.metrics.avgPauseSec.toFixed(2)}s` : '—'} />
                  </div>

                  {!!resp.speech.suggestions?.length && (
                    <>
                      <div className="mt-3 text-[12px] font-medium text-zinc-700">建議</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-zinc-700">
                        {resp.speech.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function BandKV({ label, value, color = 'zinc' }: { label: string; value?: number; color?: 'zinc' | 'amber' }) {
  if (value == null) return (
    <div className="mt-2 flex items-center justify-between text-[12px] text-zinc-600">
      <span>{label}</span><span>—</span>
    </div>
  );
  const pct = Math.max(0, Math.min(100, (value / 9) * 100));
  const bar = color === 'amber' ? 'bg-amber-500/80' : 'bg-zinc-700';
  return (
    <div className="mt-2 flex items-center justify-between">
      <span className="text-[12px] text-zinc-600">{label}</span>
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-200">
          <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[12px] font-medium text-zinc-800">{value.toFixed(1).replace(/\.0$/, '')}</span>
      </div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="text-[12px] font-medium text-zinc-800">{value}</div>
    </div>
  );
}
function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(b);
  });
}
