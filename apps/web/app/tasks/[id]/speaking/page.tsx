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
  1: { label: 'Part 1', desc: 'Short Q&A (4-5 mins)', apiPart: 'part1' },
  2: { label: 'Part 2', desc: 'Long Turn / Cue Card (2 mins)', apiPart: 'part2' },
  3: { label: 'Part 3', desc: 'Discussion (4-5 mins)', apiPart: 'part3' },
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
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[14px] sm:text-[13px] text-zinc-500 hover:text-zinc-800 min-h-[44px] flex items-center">
              ← 回首頁
            </Link>
            <h1 className="text-[18px] font-medium tracking-tight">
              Speaking（{PART_CONFIG[activePart].label}）
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Part selector */}
            <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
              {([1, 2, 3] as SpeakingPart[]).map((p) => (
                <button
                  key={p}
                  onClick={() => switchPart(p)}
                  className={[
                    'px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px] transition-colors',
                    p === activePart
                      ? 'bg-amber-50 text-amber-900 font-medium'
                      : 'bg-white text-zinc-600 hover:bg-zinc-50',
                    p !== 1 ? 'border-l border-zinc-200' : '',
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
                'rounded-xl border px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px]',
                loadingPrompt
                  ? 'cursor-wait border-zinc-200 bg-zinc-100 text-zinc-400'
                  : 'border-zinc-300 bg-white hover:bg-zinc-50',
              ].join(' ')}
            >
              {loadingPrompt ? '抽題中...' : '換一題'}
            </button>
            <button
              onClick={() => resetAll(true)}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px] hover:bg-zinc-50"
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
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px] text-red-700 hover:bg-red-100"
                  >
                    取消
                  </button>
                ) : recState === 'idle' ? (
                  <button
                    onClick={startPrepMode}
                    className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px] text-purple-800 hover:bg-purple-100"
                    title="1分鐘準備，時間到自動開始錄音"
                  >
                    模擬考
                  </button>
                ) : null}
              </>
            )}
            <div className="text-[12px] sm:text-[11px] text-zinc-500">Task #{taskId}</div>
          </div>
        </div>
        <div className="mt-1 text-[12px] text-zinc-400">{PART_CONFIG[activePart].desc}</div>
      </header>

      {/* Prep countdown banner */}
      {prepMode && (
        <div className="sticky top-0 z-20 mx-auto max-w-6xl px-4 sm:px-8 py-3 sm:py-2 flex items-center justify-center gap-3 bg-purple-50 border-b border-purple-200">
          <span className="text-[12px] font-medium text-zinc-700">準備時間</span>
          <span className="text-[20px] font-bold tabular-nums text-purple-700">{prepMM}:{prepSS}</span>
          <span className="text-[11px] text-zinc-500">時間到自動開始錄音</span>
        </div>
      )}

      <section className="mx-auto max-w-6xl px-4 sm:px-8 pb-12">
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
          {/* 左側：題目 + 錄音 */}
          <div className="space-y-6">
            {/* 題目卡 */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
              {activePart === 2 ? (
                <>
                  <div className="text-[12px] font-medium tracking-wide text-amber-700">CUE CARD</div>
                  {loadingPrompt ? (
                    <div className="mt-2 h-16 animate-pulse rounded-xl bg-zinc-100" />
                  ) : (
                    <div className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7] text-zinc-900">
                      {prompt || '（尚未取得題目）'}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-[12px] font-medium tracking-wide text-amber-700">
                    {activePart === 1 ? 'PART 1 — SHORT Q&A' : 'PART 3 — DISCUSSION'}
                  </div>
                  {loadingPrompt ? (
                    <div className="mt-2 h-16 animate-pulse rounded-xl bg-zinc-100" />
                  ) : questions.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {questions.map((q, i) => (
                        <div
                          key={i}
                          className={[
                            'rounded-lg border px-3 py-2 text-[14px] leading-[1.6] transition-colors',
                            i === currentQuestionIdx
                              ? 'border-amber-300 bg-amber-50/60 text-zinc-900'
                              : i < currentQuestionIdx
                                ? 'border-zinc-200 bg-zinc-50 text-zinc-400 line-through'
                                : 'border-zinc-200 bg-white text-zinc-600',
                          ].join(' ')}
                        >
                          <span className="text-[12px] text-zinc-400 mr-1">Q{i + 1}.</span> {q}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-zinc-400">
                          Question {Math.min(currentQuestionIdx + 1, questions.length)} of {questions.length}
                        </span>
                        {currentQuestionIdx < questions.length - 1 && recState === 'idle' && (
                          <button
                            onClick={() => setCurrentQuestionIdx((i) => Math.min(i + 1, questions.length - 1))}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 hover:bg-amber-100"
                          >
                            Next question
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[15px] text-zinc-500">（尚未取得題目）</div>
                  )}
                </>
              )}
              <details className="mt-3 group">
                <summary className="cursor-pointer list-none text-[12px] text-zinc-500 transition-colors group-open:text-zinc-800">
                  修改題目（可選）
                </summary>
                <textarea
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-[13px] leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-zinc-300"
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </details>
            </div>

            {/* 錄音卡 */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 sm:p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="text-[15px] sm:text-[14px] font-medium">
                  {activePart === 1 ? '短答錄音' : activePart === 3 ? '討論錄音' : '兩分鐘口說'}
                </div>
                <div className="rounded-lg border border-zinc-200 px-3 py-1.5 text-[13px] sm:text-[12px] text-zinc-700 font-medium tabular-nums">
                  {mm}:{ss}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {recState !== 'recording' ? (
                  <button
                    onClick={startRec}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 sm:py-2 min-h-[44px] text-[14px] sm:text-sm text-amber-900 hover:bg-amber-100"
                  >
                    開始錄音
                  </button>
                ) : (
                  <button
                    onClick={stopRec}
                    className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 sm:py-2 min-h-[44px] text-[14px] sm:text-sm text-red-900 hover:bg-red-100"
                  >
                    停止
                  </button>
                )}
                <button
                  onClick={() => resetAll(true)}
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 sm:py-2 min-h-[44px] text-[14px] sm:text-sm hover:bg-zinc-50"
                >
                  重新開始
                </button>
                {audioUrl && <audio className="mt-2 block w-full" controls src={audioUrl} />}
              </div>

              {/* 人工逐字稿（可選） */}
              <div className="mt-4">
                <div className="text-[13px] sm:text-[12px] text-zinc-500">若想跳過自動轉寫，可直接貼上逐字稿：</div>
                <textarea
                  className="mt-2 w-full min-h-[100px] rounded-xl border border-zinc-200 bg-white p-3 text-[14px] sm:text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-zinc-300"
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
                    'rounded-xl border px-4 py-2.5 sm:py-2 min-h-[44px] text-[14px] sm:text-sm transition-colors w-full sm:w-auto',
                    submitting
                      ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                      : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
                  ].join(' ')}
                >
                  {submitting ? '分析中...' : '送出並取得評分'}
                </button>
              </div>
            </div>
          </div>

          {/* 右側：結果 */}
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-medium tracking-tight">AI 評分</h3>
                {resp?.content?.band?.overall != null && (
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                    Band {resp.content.band.overall}
                  </span>
                )}
              </div>

              {/* Empty state */}
              {!resp && !submitting && (
                <div className="mt-4 rounded-lg border border-dashed border-zinc-200 p-4 text-center text-[12px] text-zinc-400">
                  送出後顯示評分與語音分析
                </div>
              )}

              {/* Loading skeleton */}
              {submitting && (
                <div className="mt-3 space-y-2">
                  <div className="h-8 animate-pulse rounded-lg bg-zinc-100" />
                  <div className="h-5 animate-pulse rounded-md bg-zinc-100" />
                  <div className="h-5 animate-pulse rounded-md bg-zinc-100" />
                  <div className="h-5 animate-pulse rounded-md bg-zinc-100" />
                </div>
              )}

              {/* Content scores */}
              {resp?.content?.band && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Content</div>
                  {/* Radar chart */}
                  {resp.content.band.taskResponse != null && resp.speech?.band?.fluency != null && (
                    <div className="flex justify-center py-2">
                      <RadarChart
                        size={180}
                        color="#f59e0b"
                        dims={[
                          { label: "Task", value: resp.content.band.taskResponse ?? 0 },
                          { label: "Vocab", value: resp.content.band.vocabulary ?? 0 },
                          { label: "Grammar", value: resp.content.band.grammar ?? 0 },
                          { label: "Fluency", value: resp.speech?.band?.fluency ?? 0 },
                          { label: "Pronunciation", value: resp.speech?.band?.pronunciation ?? 0 },
                        ]}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Score label="Overall" v={resp.content.band.overall} />
                    <Score label="Task Response" v={resp.content.band.taskResponse} />
                    <Score label="Vocabulary" v={resp.content.band.vocabulary} />
                    <Score label="Grammar" v={resp.content.band.grammar} />
                  </div>
                  {!!resp.content.suggestions?.length && (
                    <details className="mt-2">
                      <summary className="flex cursor-pointer list-none items-center justify-between pt-2">
                        <span className="text-[12px] font-medium text-zinc-700">建議</span>
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">{resp.content.suggestions.length}</span>
                      </summary>
                      <ul className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-zinc-700">
                        {resp.content.suggestions.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
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
                <div className="mt-4 border-t border-zinc-100 pt-3">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Speech</div>
                  <div className="space-y-1">
                    <Score label="Overall" v={resp.speech.band.overall} />
                    <Score label="Pronunciation" v={resp.speech.band.pronunciation} />
                    <Score label="Fluency" v={resp.speech.band.fluency} />
                  </div>
                  {!!resp.speech.metrics && (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      <Metric label="Duration" v={`${resp.speech.metrics.durationSec ?? 0}s`} />
                      <Metric label="WPM" v={`${resp.speech.metrics.wpm ?? '-'}`} />
                      <Metric
                        label="Pause Rate"
                        v={resp.speech.metrics.pauseRate != null ? `${Math.round((resp.speech.metrics.pauseRate || 0) * 100)}%` : 'n/a'}
                      />
                      <Metric
                        label="Avg Pause"
                        v={resp.speech.metrics.avgPauseSec != null ? `${resp.speech.metrics.avgPauseSec}s` : 'n/a'}
                      />
                    </div>
                  )}
                  {!!resp.speech.suggestions?.length && (
                    <details className="mt-2">
                      <summary className="flex cursor-pointer list-none items-center justify-between pt-2">
                        <span className="text-[12px] font-medium text-zinc-700">建議</span>
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">{resp.speech.suggestions.length}</span>
                      </summary>
                      <ul className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-zinc-700">
                        {resp.speech.suggestions.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
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
                    { label: 'Task Response', value: resp.content.band.taskResponse },
                    { label: 'Vocabulary', value: resp.content.band.vocabulary },
                    { label: 'Grammar', value: resp.content.band.grammar },
                    { label: 'Fluency', value: resp.speech?.band?.fluency },
                    { label: 'Pronunciation', value: resp.speech?.band?.pronunciation },
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
                <div className="mt-3 text-right text-[11px] text-zinc-400">tokens {resp.tokensUsed}</div>
              )}
              {resp?.agentMeta != null && (
                <div className="mt-1 text-right text-[10px] text-zinc-300">
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
  content: 'Content',
  vocab: 'Vocabulary',
  grammar: 'Grammar',
  fluency: 'Fluency',
  pronunciation: 'Pronunciation',
};

const SPK_TASK_LABEL: Record<string, string> = {
  speaking_part1_short_qa: 'Part 1 — Short Q&A',
  speaking_part2_long_turn: 'Part 2 — Long Turn',
  speaking_pronunciation_drill: 'Pronunciation Drill',
  speaking_part3_discussion: 'Part 3 — Discussion',
  speaking_vocabulary_practice: 'Vocabulary Practice',
  speaking_grammar_accuracy: 'Grammar Accuracy',
};

function Score({ label, v }: { label: string; v?: number }) {
  if (v == null) return null;
  const pct = Math.max(0, Math.min(100, (Number(v) / 9) * 100));
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white/60 px-2 py-1.5">
      <span className="text-[11px] text-zinc-600">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full bg-amber-500/80" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] font-medium text-zinc-800">{Number(v).toFixed(1).replace(/\.0$/, '')}</span>
      </div>
    </div>
  );
}

function Metric({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white/60 px-2 py-1">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className="text-[10px] font-medium text-zinc-700">{v}</span>
    </div>
  );
}
