'use client';

import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { StudyPlanBlock, type StudyPlan } from '@/components/StudyPlanBlock';
import { CoachBlock, type CoachSnapshotData } from '@/components/CoachBlock';
import { RadarChart } from '@/components/RadarChart';
import { getPromptText } from '@/lib/promptUtils';
import ShareScoreCard from '@/components/ShareScoreCard';

type SpeakingPart = 1 | 2 | 3;
type AgentMeta = { durationMs: number; agentsRan: string[] };
type EvalResp = {
  ok: boolean;
  requestId?: string;
  data?: {
    transcript: string;
    content?: {
      band?: {
        overall?: number;
        taskResponse?: number;
        coherence?: number;
        vocabulary?: number;
        grammar?: number;
      };
      suggestions?: string[];
    };
    speech?: {
      band?: { overall?: number; pronunciation?: number; fluency?: number };
      metrics?: {
        durationSec?: number;
        wpm?: number;
        pauseRate?: number | null;
        avgPauseSec?: number | null;
      };
      suggestions?: string[];
    };
    tokensUsed?: number;
    studyPlan?: StudyPlan;
    coachSnapshot?: CoachSnapshotData;
    agentMeta?: AgentMeta;
  };
  error?: { message: string };
};

const PART_CONFIG: Record<SpeakingPart, { label: string; desc: string; apiPart: string }> = {
  1: { label: 'Part 1', desc: '簡答問答（4-5 分鐘）', apiPart: 'part1' },
  2: { label: 'Part 2', desc: '長篇口說 / 提示卡（2 分鐘）', apiPart: 'part2' },
  3: { label: 'Part 3', desc: '深度討論（4-5 分鐘）', apiPart: 'part3' },
};

function parsePartParam(val: string | null): SpeakingPart {
  if (val === '1') return 1;
  if (val === '3') return 3;
  return 2;
}

export default function SpeakingPage() {
  const toast = useToast();
  const router = useRouter();
  const routeParams = useParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(routeParams?.id) ? routeParams?.id?.[0] : routeParams?.id || '1';
  const searchParams = useSearchParams();
  const qFromUrl = (searchParams?.get('q') || '').trim();
  const resetFlag = (searchParams?.get('reset') || '').trim() === '1';
  const activePart = parsePartParam(searchParams?.get('part') ?? null);

  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // Part 1 & 3: multiple questions from one prompt (split by newline or numbered list)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const questions = activePart !== 2
    ? prompt.split(/\n/).map((q) => q.trim()).filter(Boolean)
    : [prompt];

  // ── 模擬考：準備倒數 ──────────────────────────────────────────────────────
  const PREP_SECS = 60;
  const [prepMode, setPrepMode] = useState(false);
  const [prepSecsLeft, setPrepSecsLeft] = useState(PREP_SECS);
  const prepTimerRef = useRef<NodeJS.Timeout | null>(null);

  function startPrepMode() {
    setPrepMode(true);
    setPrepSecsLeft(PREP_SECS);
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    prepTimerRef.current = setInterval(() => {
      setPrepSecsLeft((s) => {
        if (s <= 1) {
          clearInterval(prepTimerRef.current!);
          prepTimerRef.current = null;
          setPrepMode(false);
          startRec(); // auto-start recording when prep ends
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function cancelPrepMode() {
    setPrepMode(false);
    if (prepTimerRef.current) { clearInterval(prepTimerRef.current); prepTimerRef.current = null; }
  }

  useEffect(() => () => { if (prepTimerRef.current) clearInterval(prepTimerRef.current); }, []);

  const prepMM = Math.floor(prepSecsLeft / 60).toString().padStart(2, '0');
  const prepSS = (prepSecsLeft % 60).toString().padStart(2, '0');
  // ─────────────────────────────────────────────────────────────────────────

  // 錄音
  const [recState, setRecState] = useState<'idle' | 'recording' | 'finished'>('idle');
  const [durationSec, setDurationSec] = useState(0);
  const durTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [audioUrl, setAudioUrl] = useState<string>('');

  // 可選：人工稿
  const [manualTranscript, setManualTranscript] = useState('');

  // 結果
  const [submitting, setSubmitting] = useState(false);
  const [resp, setResp] = useState<EvalResp['data']>();

  // ---------- Part switching ----------
  function switchPart(newPart: SpeakingPart) {
    const url = new URL(window.location.href);
    url.searchParams.set('part', String(newPart));
    url.searchParams.delete('q');
    url.searchParams.delete('reset');
    resetAll(false);
    router.replace(url.pathname + url.search);
  }

  // ---------- 初始化題目 ----------
  useEffect(() => {
    (async () => {
      if (qFromUrl && qFromUrl.toLowerCase() === 'random') {
        await fetchRandomPrompt();
        return;
      }
      if (qFromUrl) {
        setPrompt(qFromUrl);
        return;
      }
      // 預設就抽一題
      await fetchRandomPrompt();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl, taskId, activePart]);

  // 帶 reset=1 → 清一次並去除參數
  useEffect(() => {
    if (resetFlag) {
      resetAll(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      router.replace(url.pathname + (url.search ? url.search : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetFlag]);

  // ---------- 抽題（強韌流程） ----------
  async function fetchRandomPrompt() {
    setLoadingPrompt(true);
    setResp(undefined);
    setCurrentQuestionIdx(0);
    const apiPart = PART_CONFIG[activePart].apiPart;
    try {
      // 1) 直接抽
      const r1 = await tryRandom(apiPart);
      if (r1) return;

      // 2) 無 → 先種子
      await fetch('/api/prompts/seed', { method: 'POST' });
      const r2 = await tryRandom(apiPart);
      if (r2) return;

      // 3) 再無 → 生成一批
      await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'speaking', part: apiPart, count: 8 }),
      });
      const r3 = await tryRandom(apiPart);
      if (r3) return;

      toast.push('暫無題目可抽，稍後再試');
    } catch {
      toast.push('抽題失敗');
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function tryRandom(apiPart: string): Promise<boolean> {
    const res = await fetch(`/api/prompts/random?type=speaking&part=${apiPart}`, { cache: 'no-store' });
    const json = await res.json();
    const text = getPromptText(json?.data);
    if (json?.ok && text) {
      setPrompt(text);
      return true;
    }
    return false;
  }

  // ---------- 錄音 ----------
  async function startRec() {
    setResp(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      mr.start();
      mediaRef.current = mr;
      setRecState('recording');
      setDurationSec(0);
      if (durTimerRef.current) clearInterval(durTimerRef.current);
      durTimerRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000);
    } catch {
      toast.push('麥克風權限被拒絕');
    }
  }

  function stopRec() {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (durTimerRef.current) clearInterval(durTimerRef.current);
    durTimerRef.current = null;
    setRecState('finished');
  }

  function resetAll(showToast = true) {
    setRecState('idle');
    setDurationSec(0);
    setResp(undefined);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    setManualTranscript('');
    setCurrentQuestionIdx(0);
    if (showToast) toast.push('已開始新一輪');
  }

  // ---------- 送審 ----------
  async function submit() {
    if (!audioUrl && !manualTranscript.trim()) {
      toast.push('請先錄音或填寫逐字稿');
      return;
    }
    setSubmitting(true);
    setResp(undefined);
    try {
      let audioBase64 = '';
      let mime = 'audio/webm';
      if (audioUrl) {
        const blob = await (await fetch(audioUrl)).blob();
        mime = blob.type || 'audio/webm';
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        audioBase64 = btoa(binary);
      }

      const res = await fetch('/api/speaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          part: activePart,
          audioBase64,
          mime,
          durationSec: Math.max(1, durationSec),
          manualTranscript: manualTranscript.trim() || undefined,
        }),
      });
      const json: EvalResp = await res.json();
      if (!json.ok) throw new Error(json?.error?.message || '分析失敗');
      setResp(json.data);
      toast.push('已取得評分');
    } catch (e: any) {
      toast.push(e?.message || '送出失敗');
    } finally {
      setSubmitting(false);
    }
  }

  const mm = Math.floor(durationSec / 60).toString().padStart(2, '0');
  const ss = (durationSec % 60).toString().padStart(2, '0');

  return (
    <main className="relative min-h-dvh bg-[#f7f5ff] text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/" className="text-[14px] sm:text-[13px] font-bold text-[#1CB0F6] hover:text-[#1899d6] min-h-[44px] flex items-center">
              ← 回首頁
            </Link>
            <h1 className="text-xl font-bold tracking-tight">
              口說練習（{PART_CONFIG[activePart].label}）
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Part selector — Duolingo segment pills */}
            <div className="flex rounded-2xl bg-white p-1 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)] border-2 border-zinc-200">
              {([1, 2, 3] as SpeakingPart[]).map((p) => (
                <button
                  key={p}
                  onClick={() => switchPart(p)}
                  className={[
                    'rounded-xl px-4 py-2 min-h-[44px] text-sm font-bold transition-all',
                    p === activePart
                      ? 'bg-[#FFD900] text-amber-900 shadow-[0_3px_0_0_#e6c300]'
                      : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50',
                  ].join(' ')}
                >
                  P{p}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchRandomPrompt()}
              disabled={loadingPrompt}
              className={[
                'rounded-xl border-2 px-4 py-2 min-h-[44px] text-sm font-bold transition-all',
                loadingPrompt
                  ? 'cursor-wait border-zinc-200 bg-zinc-100 text-zinc-400'
                  : 'border-[#1CB0F6] bg-white text-[#1CB0F6] hover:bg-[#1CB0F6] hover:text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]',
              ].join(' ')}
            >
              {loadingPrompt ? '抽題中...' : '換一題'}
            </button>
            <button
              onClick={() => resetAll(true)}
              className="rounded-xl border-2 border-zinc-300 bg-white px-4 py-2 min-h-[44px] text-sm font-bold hover:bg-zinc-50 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]"
              title="清空錄音/稿/結果並重新開始"
            >
              開始新一輪
            </button>
            {/* Prep mode (mock exam) only for Part 2 */}
            {activePart === 2 && (
              <>
                {prepMode ? (
                  <button
                    onClick={cancelPrepMode}
                    className="rounded-xl border-2 border-[#FF4B4B] bg-[#FFF0F0] px-4 py-2 min-h-[44px] text-sm font-bold text-[#FF4B4B] hover:bg-[#FFE0E0] shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]"
                  >
                    取消
                  </button>
                ) : recState === 'idle' ? (
                  <button
                    onClick={startPrepMode}
                    className="rounded-xl border-2 border-[#CE82FF] bg-[#F5EEFF] px-4 py-2 min-h-[44px] text-sm font-bold text-[#7B2FBE] hover:bg-[#EDE0FF] shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]"
                    title="1分鐘準備，時間到自動開始錄音"
                  >
                    模擬考
                  </button>
                ) : null}
              </>
            )}
            <div className="rounded-xl bg-white border-2 border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500">
              任務 #{taskId}
            </div>
          </div>
        </div>
        <div className="mt-2 inline-block rounded-xl bg-[#FFD900]/20 px-3 py-1 text-xs font-bold text-amber-700">
          {PART_CONFIG[activePart].desc}
        </div>
      </header>

      {/* Prep countdown banner */}
      {prepMode && (
        <div className="sticky top-0 z-20 mx-auto max-w-6xl px-4 sm:px-8 py-3 sm:py-2 flex items-center justify-center gap-3 bg-[#CE82FF] text-white rounded-b-2xl">
          <span className="text-sm font-bold">準備時間</span>
          <span className="text-2xl font-bold tabular-nums">{prepMM}:{prepSS}</span>
          <span className="text-xs font-bold opacity-80">時間到自動開始錄音</span>
        </div>
      )}

      <section className="mx-auto max-w-6xl px-4 sm:px-8 pb-12">
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
          {/* 左側：題目 + 錄音 */}
          <div className="space-y-6">
            {/* 題目卡 */}
            <div className="rounded-3xl border-2 border-zinc-200 bg-white p-5 sm:p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
              {activePart === 2 ? (
                <>
                  <div className="inline-block rounded-xl bg-[#FFD900] px-3 py-1 text-xs font-bold text-amber-900">
                    提示卡
                  </div>
                  {loadingPrompt ? (
                    <div className="mt-3 h-16 animate-pulse rounded-2xl bg-zinc-100" />
                  ) : (
                    <div className="mt-3 whitespace-pre-wrap text-base leading-[1.8] text-zinc-900 font-medium">
                      {prompt || '（尚未取得題目）'}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="inline-block rounded-xl bg-[#FFD900] px-3 py-1 text-xs font-bold text-amber-900">
                    {activePart === 1 ? 'Part 1 — 簡答問答' : 'Part 3 — 深度討論'}
                  </div>
                  {loadingPrompt ? (
                    <div className="mt-3 h-16 animate-pulse rounded-2xl bg-zinc-100" />
                  ) : questions.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {questions.map((q, i) => (
                        <div
                          key={i}
                          className={[
                            'rounded-2xl border-2 px-4 py-3 text-sm leading-[1.6] transition-all font-medium',
                            i === currentQuestionIdx
                              ? 'border-[#FFD900] bg-[#FFFDE7] text-zinc-900 shadow-[0_3px_0_0_#e6c300]'
                              : i < currentQuestionIdx
                                ? 'border-[#58CC02] bg-[#F0FDE4] text-zinc-500 line-through'
                                : 'border-zinc-200 bg-white text-zinc-600',
                          ].join(' ')}
                        >
                          <span className={[
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mr-2',
                            i === currentQuestionIdx
                              ? 'bg-[#FFD900] text-amber-900'
                              : i < currentQuestionIdx
                                ? 'bg-[#58CC02] text-white'
                                : 'bg-zinc-200 text-zinc-500',
                          ].join(' ')}>
                            {i < currentQuestionIdx ? '✓' : `${i + 1}`}
                          </span>
                          {q}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs font-bold text-zinc-400">
                          第 {Math.min(currentQuestionIdx + 1, questions.length)} 題，共 {questions.length} 題
                        </span>
                        {currentQuestionIdx < questions.length - 1 && recState === 'idle' && (
                          <button
                            onClick={() => setCurrentQuestionIdx((i) => Math.min(i + 1, questions.length - 1))}
                            className="rounded-xl border-2 border-[#FFD900] bg-[#FFFDE7] px-3 py-1 text-xs font-bold text-amber-800 hover:bg-[#FFF9C4] shadow-[2px_2px_0_0_rgba(0,0,0,0.08)]"
                          >
                            下一題
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-base font-medium text-zinc-500">（尚未取得題目）</div>
                  )}
                </>
              )}
              <details className="mt-4 group">
                <summary className="cursor-pointer list-none text-xs font-bold text-zinc-500 transition-colors group-open:text-zinc-800">
                  修改題目（可選）
                </summary>
                <textarea
                  className="mt-2 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50/60 p-3 text-sm leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-[#1CB0F6] focus:border-[#1CB0F6]"
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </details>
            </div>

            {/* 錄音卡 */}
            <div className="rounded-3xl border-2 border-zinc-200 bg-white p-4 sm:p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between">
                <div className="text-base font-bold">
                  {activePart === 1 ? '簡答錄音' : activePart === 3 ? '討論錄音' : '兩分鐘口說'}
                </div>
                <div className="rounded-xl border-2 border-[#FFD900] bg-[#FFFDE7] px-4 py-2 text-sm font-bold text-amber-800 tabular-nums">
                  {mm}:{ss}
                </div>
              </div>

              <div className="mt-4 flex flex-col items-center gap-3">
                {/* Big Record Button */}
                {recState !== 'recording' ? (
                  <button
                    onClick={startRec}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FF4B4B] text-white shadow-[0_6px_0_0_#cc3c3c] hover:bg-[#e64444] active:shadow-none active:translate-y-1.5 transition-all"
                    aria-label="開始錄音"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={stopRec}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FF4B4B] text-white shadow-[0_6px_0_0_#cc3c3c] animate-pulse hover:bg-[#e64444] active:shadow-none active:translate-y-1.5 transition-all"
                    aria-label="停止錄音"
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                )}

                <div className="text-sm font-bold text-zinc-500">
                  {recState === 'idle' && '點擊開始錄音'}
                  {recState === 'recording' && '錄音中... 點擊停止'}
                  {recState === 'finished' && '錄音完成'}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => resetAll(true)}
                    className="rounded-xl border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-bold hover:bg-zinc-50 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]"
                  >
                    重新開始
                  </button>
                </div>
                {audioUrl && <audio className="mt-2 block w-full" controls src={audioUrl} />}
              </div>

              {/* 人工逐字稿（可選） */}
              <div className="mt-4">
                <div className="text-xs font-bold text-zinc-500">若想跳過自動轉寫，可直接貼上逐字稿：</div>
                <textarea
                  className="mt-2 w-full min-h-[100px] rounded-2xl border-2 border-zinc-200 bg-white p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-[#1CB0F6] focus:border-[#1CB0F6]"
                  placeholder="（可選）在此輸入口說逐字稿..."
                  value={manualTranscript}
                  onChange={(e) => setManualTranscript(e.target.value)}
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={submit}
                  disabled={submitting || (!audioUrl && !manualTranscript.trim()) || !prompt}
                  className={[
                    'rounded-xl border-2 px-5 py-2.5 sm:py-2 min-h-[44px] text-sm font-bold transition-all w-full sm:w-auto',
                    submitting
                      ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                      : 'border-[#58CC02] bg-[#58CC02] text-white hover:bg-[#46a302] shadow-[0_4px_0_0_#46a302] active:shadow-none active:translate-y-1',
                  ].join(' ')}
                >
                  {submitting ? '分析中...' : '送出並取得評分'}
                </button>
              </div>
            </div>
          </div>

          {/* 右側：結果 */}
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="rounded-3xl border-2 border-zinc-200 bg-white p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">AI 評分</h3>
                {resp?.content?.band?.overall != null && (
                  <span className="rounded-xl bg-[#FFD900] px-2.5 py-1 text-xs font-bold text-amber-900 shadow-[0_2px_0_0_#e6c300]">
                    Band {resp.content.band.overall}
                  </span>
                )}
              </div>

              {/* Empty state */}
              {!resp && !submitting && (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center text-sm font-bold text-zinc-400">
                  送出後顯示評分與語音分析
                </div>
              )}

              {/* Loading skeleton */}
              {submitting && (
                <div className="mt-3 space-y-2">
                  <div className="h-8 animate-pulse rounded-2xl bg-zinc-100" />
                  <div className="h-5 animate-pulse rounded-xl bg-zinc-100" />
                  <div className="h-5 animate-pulse rounded-xl bg-zinc-100" />
                  <div className="h-5 animate-pulse rounded-xl bg-zinc-100" />
                </div>
              )}

              {/* Content scores */}
              {resp?.content?.band && (
                <div className="mt-3">
                  <div className="mb-2 inline-block rounded-xl bg-[#58CC02] px-3 py-1 text-xs font-bold text-white">
                    內容評分
                  </div>
                  {/* Radar chart */}
                  {resp.content.band.taskResponse != null && resp.speech?.band?.fluency != null && (
                    <div className="flex justify-center py-2">
                      <RadarChart
                        size={180}
                        color="#FFD900"
                        dims={[
                          { label: "任務", value: resp.content.band.taskResponse ?? 0 },
                          { label: "詞彙", value: resp.content.band.vocabulary ?? 0 },
                          { label: "文法", value: resp.content.band.grammar ?? 0 },
                          { label: "流暢度", value: resp.speech?.band?.fluency ?? 0 },
                          { label: "發音", value: resp.speech?.band?.pronunciation ?? 0 },
                        ]}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Score label="整體" v={resp.content.band.overall} color="#FFD900" />
                    <Score label="任務回應" v={resp.content.band.taskResponse} color="#58CC02" />
                    <Score label="詞彙" v={resp.content.band.vocabulary} color="#1CB0F6" />
                    <Score label="文法" v={resp.content.band.grammar} color="#CE82FF" />
                  </div>
                  {!!resp.content.suggestions?.length && (
                    <details className="mt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between pt-2">
                        <span className="text-sm font-bold text-zinc-700">建議</span>
                        <span className="rounded-full bg-[#FFD900] px-2 py-0.5 text-xs font-bold text-amber-800">{resp.content.suggestions.length}</span>
                      </summary>
                      <ul className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-700">
                        {resp.content.suggestions.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#58CC02]" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {/* Speech scores */}
              {resp?.speech?.band && (
                <div className="mt-4 border-t-2 border-zinc-100 pt-3">
                  <div className="mb-2 inline-block rounded-xl bg-[#CE82FF] px-3 py-1 text-xs font-bold text-white">
                    語音評分
                  </div>
                  <div className="space-y-2">
                    <Score label="整體" v={resp.speech.band.overall} color="#CE82FF" />
                    <Score label="發音" v={resp.speech.band.pronunciation} color="#FF4B4B" />
                    <Score label="流暢度" v={resp.speech.band.fluency} color="#1CB0F6" />
                  </div>
                  {!!resp.speech.metrics && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Metric label="語料長度" v={`${resp.speech.metrics.durationSec ?? 0}s`} />
                      <Metric label="語速" v={`${resp.speech.metrics.wpm ?? '-'}`} />
                      <Metric
                        label="停頓比例"
                        v={resp.speech.metrics.pauseRate != null ? `${Math.round((resp.speech.metrics.pauseRate || 0) * 100)}%` : 'n/a'}
                      />
                      <Metric
                        label="平均停頓"
                        v={resp.speech.metrics.avgPauseSec != null ? `${resp.speech.metrics.avgPauseSec}s` : 'n/a'}
                      />
                    </div>
                  )}
                  {!!resp.speech.suggestions?.length && (
                    <details className="mt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between pt-2">
                        <span className="text-sm font-bold text-zinc-700">建議</span>
                        <span className="rounded-full bg-[#CE82FF] px-2 py-0.5 text-xs font-bold text-white">{resp.speech.suggestions.length}</span>
                      </summary>
                      <ul className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-700">
                        {resp.speech.suggestions.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#CE82FF]" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {/* Share */}
              {resp?.content?.band?.overall != null && (
                <ShareScoreCard
                  type="speaking"
                  overall={resp.content.band.overall}
                  scores={[
                    { label: '任務回應', value: resp.content.band.taskResponse },
                    { label: '詞彙', value: resp.content.band.vocabulary },
                    { label: '文法', value: resp.content.band.grammar },
                    { label: '流暢度', value: resp.speech?.band?.fluency },
                    { label: '發音', value: resp.speech?.band?.pronunciation },
                  ]}
                />
              )}

              {/* Study plan */}
              {!!resp?.studyPlan && (
                <StudyPlanBlock plan={resp.studyPlan} dimLabel={SPK_DIM_LABEL} taskLabel={SPK_TASK_LABEL} accent="amber" />
              )}

              {/* Coach snapshot */}
              {!!resp?.coachSnapshot && (
                <CoachBlock snapshot={resp.coachSnapshot} />
              )}

              {!!resp?.tokensUsed && (
                <div className="mt-3 text-right text-xs font-bold text-zinc-300">tokens {resp.tokensUsed}</div>
              )}
              {resp?.agentMeta != null && (
                <div className="mt-1 text-right text-[10px] font-bold text-zinc-300">
                  {resp.agentMeta.agentsRan.length} agents · {resp.agentMeta.durationMs}ms
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

const SPK_DIM_LABEL: Record<string, string> = {
  content: '內容',
  vocab: '詞彙',
  grammar: '文法',
  fluency: '流暢度',
  pronunciation: '發音',
};

const SPK_TASK_LABEL: Record<string, string> = {
  speaking_part1_short_qa: 'Part 1 — 簡答問答',
  speaking_part2_long_turn: 'Part 2 — 長篇口說',
  speaking_pronunciation_drill: '發音練習',
  speaking_part3_discussion: 'Part 3 — 深度討論',
  speaking_vocabulary_practice: '詞彙練習',
  speaking_grammar_accuracy: '文法正確性',
};

function Score({ label, v, color = '#FFD900' }: { label: string; v?: number; color?: string }) {
  if (v == null) return null;
  const pct = Math.max(0, Math.min(100, (Number(v) / 9) * 100));
  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-zinc-200 bg-white px-3 py-2">
      <span className="text-xs font-bold text-zinc-600">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-3 w-20 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-sm font-bold text-zinc-800">{Number(v).toFixed(1).replace(/\.0$/, '')}</span>
      </div>
    </div>
  );
}

function Metric({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border-2 border-zinc-200 bg-white px-3 py-2">
      <span className="text-xs font-bold text-zinc-500">{label}</span>
      <span className="text-xs font-bold text-zinc-700">{v}</span>
    </div>
  );
}
