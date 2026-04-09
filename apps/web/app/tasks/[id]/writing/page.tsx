'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { StudyPlanBlock, type StudyPlan } from '@/components/StudyPlanBlock';
import { CoachBlock, type CoachSnapshotData } from '@/components/CoachBlock';
import { MlStatusBadge } from '@/components/MlStatusBadge';
import { RadarChart } from '@/components/RadarChart';
import { InlineEssay } from '@/components/InlineEssay';
import { getPromptText } from '@/lib/promptUtils';
import ShareScoreCard from '@/components/ShareScoreCard';

type BandScores = { overall?: number; taskResponse?: number; coherence?: number; lexical?: number; grammar?: number; };
type ParagraphFeedback = { index: number; comment: string };
type AgentMeta = { durationMs: number; agentsRan: string[] };
type SubmitResponse = {
  ok: boolean;
  data?: { band?: BandScores | null; bandMargin?: number; paragraphFeedback?: ParagraphFeedback[]; improvements?: string[]; rewritten?: string; tokensUsed?: number; studyPlan?: StudyPlan; coachSnapshot?: CoachSnapshotData; agentMeta?: AgentMeta };
  error?: { code: string; message: string };
  requestId?: string;
};

export default function WritingTaskPage() {
  const toast = useToast();
  const router = useRouter();
  const routeParams = useParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(routeParams?.id) ? routeParams?.id?.[0] : routeParams?.id || '1';
  const searchParams = useSearchParams();
  const qFromUrl = (searchParams?.get('q') || '').trim();
  const resetFlag = (searchParams?.get('reset') || '').trim() === '1';

  const [prompt, setPrompt] = useState<string>('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  const [essay, setEssay] = useState<string>('');
  const [targetWords, setTargetWords] = useState<number>(250);
  const [seconds, setSeconds] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<SubmitResponse['data']>();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyRef = useRef(false);
  const [showRight, setShowRight] = useState(true);

  // ── Exam simulation mode ──────────────────────────────────────────────────
  const EXAM_SECS = 40 * 60; // 40 minutes
  const [examMode, setExamMode] = useState(false);
  const [examSecsLeft, setExamSecsLeft] = useState(EXAM_SECS);
  const examTimerRef = useRef<NodeJS.Timeout | null>(null);

  function startExamMode() {
    setExamMode(true);
    setExamSecsLeft(EXAM_SECS);
    setResult(undefined);
    setError('');
    if (examTimerRef.current) clearInterval(examTimerRef.current);
    examTimerRef.current = setInterval(() => {
      setExamSecsLeft((s) => {
        if (s <= 1) {
          clearInterval(examTimerRef.current!);
          examTimerRef.current = null;
          // auto-submit when time is up
          setExamMode(false);
          onSubmit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function cancelExamMode() {
    setExamMode(false);
    if (examTimerRef.current) { clearInterval(examTimerRef.current); examTimerRef.current = null; }
    setExamSecsLeft(EXAM_SECS);
  }

  // cleanup on unmount
  useEffect(() => () => { if (examTimerRef.current) clearInterval(examTimerRef.current); }, []);

  const examMM = Math.floor(examSecsLeft / 60).toString().padStart(2, '0');
  const examSS = (examSecsLeft % 60).toString().padStart(2, '0');
  const examUrgent = examSecsLeft <= 300; // last 5 min → red
  // ─────────────────────────────────────────────────────────────────────────

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
      await fetchRandomPrompt();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl, taskId]);

  // 若帶 reset=1 參數 → 直接清空一次（並把網址還原成不帶 reset 的版本）
  useEffect(() => {
    if (resetFlag) {
      resetAttempt(false);
      // 去掉 reset=1，避免 F5 又清一次
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      router.replace(url.pathname + (url.search ? url.search : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetFlag]);

  async function fetchRandomPrompt(retryOnce = true) {
    try {
      setLoadingPrompt(true);
      const res = await fetch(`/api/prompts/random?type=writing&part=task2`, { cache: 'no-store' });
      const json = await res.json();
      const text = getPromptText(json?.data);
      if (json?.ok && text) {
        setPrompt(text);
        return;
      }
      if (retryOnce) {
        await fetch('/api/prompts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'writing', part: 'task2', count: 10 }),
        });
        await fetchRandomPrompt(false);
      } else {
        toast.push('暫無題目可抽，稍後再試');
      }
    } catch (e) {
      toast.push('抽題失敗');
    } finally {
      setLoadingPrompt(false);
    }
  }

  // ---------- 計時 ----------
  useEffect(() => {
    if (essay.trim().length > 0 && !timerRef.current) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  }, [essay]);

  // ---------- Autosave ----------
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => {
      localStorage.setItem(draftKey(taskId), essay);
      setSavedAt(Date.now());
    }, 5000);
    return () => clearInterval(t);
  }, [essay, taskId]);

  // 載入草稿（除非 reset 已處理）
  useEffect(() => {
    const draft = localStorage.getItem(draftKey(taskId));
    if (draft && !essay) setEssay(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // ---------- 離頁提醒 ----------
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current && essay.trim().length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [essay]);

  // ---------- 熱鍵 ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        if (!submitting && essay.trim().length >= 30) onSubmit();
      }
      if (e.key === 'Escape') setResult(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, essay]);

  const words = useMemo(() => countWords(essay), [essay]);
  const minutes = Math.floor(seconds / 60);
  const sec = seconds % 60;

  const wordHint = useMemo(() => {
    const diff = words - targetWords;
    if (words === 0) return '開始撰寫吧（建議 250 字左右）';
    if (Math.abs(diff) <= 20) return '字數很接近目標，保持！';
    if (diff < 0) return `再多 ${Math.abs(diff)} 字會更好`;
    return `超出約 ${diff} 字，考場時間要抓緊`;
  }, [words, targetWords]);

  async function onSubmit() {
    setError(''); setSubmitting(true); setResult(undefined);
    try {
      const res = await fetch('/api/writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, prompt, essay, targetWords, seconds }),
      });
      const json: SubmitResponse = await res.json();
      if (!json.ok) throw new Error(json.error?.message || '分析失敗，稍後再試');
      setResult(json.data);
      dirtyRef.current = false;
      toast.push('已取得評分');
    } catch (e: any) {
      setError(e?.message || '發生未預期錯誤');
      toast.push('送出失敗');
    } finally {
      setSubmitting(false);
    }
  }

  function resetAttempt(showToast = true) {
    setEssay('');
    setSeconds(0);
    setResult(undefined);
    setError('');
    localStorage.removeItem(draftKey(taskId));
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (showToast) toast.push('已開始新一輪');
  }

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[14px] sm:text-[13px] text-zinc-500 hover:text-zinc-800 min-h-[44px] flex items-center">← 回首頁</Link>
            <h1 className="text-[18px] font-medium tracking-tight">Writing Task 2</h1>
            <MlStatusBadge />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchRandomPrompt()}
              disabled={loadingPrompt}
              className={[
                'rounded-xl border px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px]',
                loadingPrompt ? 'cursor-wait border-zinc-200 bg-zinc-100 text-zinc-400' : 'border-zinc-300 bg-white hover:bg-zinc-50'
              ].join(' ')}
            >
              {loadingPrompt ? '抽題中…' : '換一題'}
            </button>
            <button
              onClick={() => resetAttempt(true)}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px] hover:bg-zinc-50"
              title="清空草稿並重新開始一次"
            >
              開始新一輪
            </button>
            {examMode ? (
              <button
                onClick={cancelExamMode}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px] text-red-700 hover:bg-red-100"
              >
                取消模擬考
              </button>
            ) : (
              <button
                onClick={startExamMode}
                className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 min-h-[44px] text-[13px] sm:text-[12px] text-purple-800 hover:bg-purple-100"
                title="40 分鐘限時，時間到自動送出"
              >
                模擬考
              </button>
            )}
            <div className="text-[12px] sm:text-[11px] text-zinc-500">Task #{taskId}</div>
          </div>
        </div>
      </header>

      {/* Exam mode countdown banner */}
      {examMode && (
        <div className={[
          'sticky top-0 z-20 mx-auto max-w-6xl px-4 sm:px-8 py-3 sm:py-2',
          'flex items-center justify-center gap-3',
          examUrgent ? 'bg-red-50 border-b border-red-200' : 'bg-purple-50 border-b border-purple-200',
        ].join(' ')}>
          <span className="text-[12px] font-medium text-zinc-700">⏱ 模擬考模式</span>
          <span className={[
            'text-[20px] font-bold tabular-nums',
            examUrgent ? 'text-red-600' : 'text-purple-700',
          ].join(' ')}>
            {examMM}:{examSS}
          </span>
          <span className="text-[11px] text-zinc-500">時間到自動送出</span>
        </div>
      )}

      <section className="mx-auto max-w-6xl px-4 sm:px-8 pb-12">
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.6fr_0.4fr]">
          {/* 左側 */}
          <div className="space-y-6">
            {/* 題目卡 */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-[12px] font-medium tracking-wide text-blue-700">PROMPT</div>
                  {loadingPrompt ? (
                    <div className="mt-2 h-16 animate-pulse rounded-xl bg-zinc-100" />
                  ) : (
                    <div className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7] text-zinc-900">
                      {prompt || '（尚未取得題目）'}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <button
                    onClick={async () => { if (await copySafe(prompt)) toast.push('已複製題目'); }}
                    disabled={!prompt}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-[12px]",
                      prompt ? "border-zinc-300 bg-white hover:bg-zinc-50" : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                    ].join(" ")}
                    title="複製題目"
                  >
                    複製題目
                  </button>
                  <button
                    onClick={() => setPrompt('')}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[12px] hover:bg-zinc-50"
                    title="清除題目"
                  >
                    清除
                  </button>
                </div>
              </div>

              {/* 可選：修改題目 */}
              <details className="mt-3 group">
                <summary className="cursor-pointer list-none text-[12px] text-zinc-500 transition-colors group-open:text-zinc-800">
                  修改題目（可選）
                </summary>
                <textarea
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-[13px] leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-zinc-300"
                  rows={2}
                  value={prompt}
                  onChange={(e) => { dirtyRef.current = true; setPrompt(e.target.value); }}
                />
              </details>
            </div>

            {/* 編輯器 */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 sm:p-6 shadow-sm backdrop-blur">
              {/* Word count and timer bar - sticky on mobile for visibility during writing */}
              <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-white/95 backdrop-blur border-b border-zinc-100 mb-3 sm:relative sm:border-b-0 sm:mb-0 sm:bg-transparent sm:backdrop-blur-none">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 text-[13px] sm:text-[12px] text-zinc-500">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 sm:py-1">
                      時間 <span className="font-medium text-zinc-800">{minutes}:{sec.toString().padStart(2, '0')}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 sm:py-1">
                      字數 <span className="font-medium text-zinc-800">{words}</span>
                    </span>
                    <span className="hidden sm:inline text-zinc-500">({wordHint})</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-[13px] sm:text-[12px] text-zinc-500 shrink-0">目標字數</label>
                    <input type="range" min={180} max={350} step={10}
                      value={targetWords} onChange={(e) => { dirtyRef.current = true; setTargetWords(Number(e.target.value)); }}
                      className="flex-1 sm:w-52 accent-zinc-700 min-h-[44px]" />
                    <span className="text-[13px] sm:text-[12px] text-zinc-700 shrink-0">{targetWords}</span>
                  </div>
                </div>
              </div>

              <textarea
                className="mt-3 w-full min-h-[250px] sm:min-h-[300px] rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 text-[15px] sm:text-[14px] leading-[1.75] outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="在此撰寫或貼上你的作文..."
                value={essay}
                onChange={(e) => { dirtyRef.current = true; setEssay(e.target.value); }}
              />

              <div className="mt-2 text-[11px] text-zinc-500">
                {savedAt ? <>已自動保存 {new Date(savedAt).toLocaleTimeString()}</> : '將自動保存草稿'}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="hidden sm:block text-[12px] text-zinc-500">快捷鍵：Ctrl/Cmd+Enter 送出，Esc 清空結果預覽</div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => { setEssay(''); localStorage.removeItem(draftKey(taskId)); setSeconds(0); setResult(undefined); }}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 sm:py-2 text-[14px] sm:text-sm min-h-[44px] hover:bg-zinc-50 flex-1 sm:flex-none"
                  >
                    清空草稿
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={submitting || essay.trim().length < 30 || !prompt}
                    className={[
                      'rounded-xl border px-4 py-2.5 sm:py-2 text-[14px] sm:text-sm min-h-[44px] transition-colors flex-1 sm:flex-none',
                      submitting
                        ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                        : 'border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100',
                    ].join(' ')}
                  >
                    {submitting ? '分析中...' : '送出並取得評分'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Compare Panel */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium tracking-tight">原文 vs. 優化版本</h3>
                <div className="flex items-center gap-2">
                  <CopyBtn text={essay} label="複製原文" onDone={() => toast.push('已複製原文')} />
                  <CopyBtn text={result?.rewritten || ''} label="複製優化稿" onDone={() => toast.push('已複製優化稿')} />
                </div>
              </div>
              <div className="mt-3 grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <div className="text-[12px] text-zinc-500 mb-1">
                    你的原文
                    {result?.paragraphFeedback?.length ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                        {result.paragraphFeedback.length} 條批注
                      </span>
                    ) : null}
                  </div>
                  <InlineEssay
                    text={essay}
                    feedback={result?.paragraphFeedback}
                  />
                </div>
                <div>
                  <div className="text-[12px] text-zinc-500">AI 優化版本</div>
                  <div className="mt-1 min-h-[120px] whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed text-zinc-800">
                    {result?.rewritten || '（送出後顯示）'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：AI 評分（sticky、可收合） */}
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-medium tracking-tight">AI 評分</h3>
                  {result?.band?.overall != null && (
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                      Band {result.band.overall}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowRight((v) => !v)}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] hover:bg-zinc-50"
                  aria-expanded={showRight}
                >
                  {showRight ? '收合' : '展開'}
                </button>
              </div>

              {!showRight && (
                <div className="mt-2 text-[12px] text-zinc-500">已收合（點「展開」查看詳情）</div>
              )}

              {showRight && (
                <>
                  {/* Empty state */}
                  {!result && !submitting && (
                    <div className="mt-4 rounded-lg border border-dashed border-zinc-200 p-4 text-center text-[12px] text-zinc-400">
                      送出後顯示評分與學習建議
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

                  {/* Scores */}
                  {result?.band && (
                    <div className="mt-3 space-y-1.5">
                      <BandBadge overall={result.band.overall} margin={result.bandMargin} />
                      {/* Radar chart */}
                      {result.band.taskResponse != null && (
                        <div className="flex justify-center py-2">
                          <RadarChart
                            size={180}
                            color="#3b82f6"
                            dims={[
                              { label: "Task", shortLabel: "Task", value: result.band.taskResponse ?? 0 },
                              { label: "Coherence", shortLabel: "Coh.", value: result.band.coherence ?? 0 },
                              { label: "Lexical", shortLabel: "Lex.", value: result.band.lexical ?? 0 },
                              { label: "Grammar", shortLabel: "Gram.", value: result.band.grammar ?? 0 },
                            ]}
                          />
                        </div>
                      )}
                      <ScoreRow compact label="Task Response" value={result.band.taskResponse} />
                      <ScoreRow compact label="Coherence & Cohesion" value={result.band.coherence} />
                      <ScoreRow compact label="Lexical Resource" value={result.band.lexical} />
                      <ScoreRow compact label="Grammar Range & Accuracy" value={result.band.grammar} />
                      <ShareScoreCard
                        type="writing"
                        overall={result.band.overall}
                        scores={[
                          { label: 'Task Response', value: result.band.taskResponse },
                          { label: 'Coherence', value: result.band.coherence },
                          { label: 'Lexical', value: result.band.lexical },
                          { label: 'Grammar', value: result.band.grammar },
                        ]}
                      />
                    </div>
                  )}

                  {/* Improvements */}
                  {!!result?.improvements?.length && (
                    <details className="mt-4 border-t border-zinc-100 pt-3" open>
                      <summary className="flex cursor-pointer list-none items-center justify-between">
                        <span className="text-[12px] font-medium text-zinc-700">改善建議</span>
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">{result.improvements.length}</span>
                      </summary>
                      <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-zinc-700">
                        {result.improvements.map((s, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                            <span className="flex-1">{s}</span>
                            <SaveToNotebookBtn text={s} examType="writing" />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Paragraph feedback */}
                  {!!result?.paragraphFeedback?.length && (
                    <details className="mt-3 border-t border-zinc-100 pt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between">
                        <span className="text-[12px] font-medium text-zinc-700">逐段建議</span>
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">{result.paragraphFeedback.length}</span>
                      </summary>
                      <div className="mt-2 space-y-1">
                        {result.paragraphFeedback.map((p) => (
                          <div key={p.index}
                            className="rounded-lg border border-zinc-200 bg-white/70 px-2 py-1.5 text-[12px] leading-relaxed text-zinc-700">
                            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] text-zinc-700">
                              {p.index + 1}
                            </span>
                            {p.comment}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Study plan */}
                  {!!result?.studyPlan && (
                    <StudyPlanBlock plan={result.studyPlan} dimLabel={DIM_LABEL} taskLabel={TASK_LABEL} accent="blue" />
                  )}

                  {/* Coach snapshot */}
                  {!!result?.coachSnapshot && (
                    <CoachBlock snapshot={result.coachSnapshot} />
                  )}

                  {!!result?.tokensUsed && (
                    <div className="mt-3 text-right text-[11px] text-zinc-400">
                      tokens {result.tokensUsed}
                    </div>
                  )}
                  {result?.agentMeta != null && (
                    <div className="mt-1 text-right text-[10px] text-zinc-300">
                      {result.agentMeta.agentsRan.length} agents · {result.agentMeta.durationMs}ms
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

/* ---------------- helpers ---------------- */

const DIM_LABEL: Record<string, string> = {
  taskResponse: 'Task Response',
  coherence: 'Coherence & Cohesion',
  lexical: 'Lexical Resource',
  grammar: 'Grammar',
};

const TASK_LABEL: Record<string, string> = {
  task1_paraphrase: 'Task 1 — Paraphrase Practice',
  task1_data: 'Task 1 — Data Description',
  task1_process: 'Task 1 — Process Description',
  task2_argument: 'Task 2 — Argument Essay',
  task2_discuss: 'Task 2 — Discussion Essay',
  task2_problem: 'Task 2 — Problem–Solution',
  task2_mixed: 'Task 2 — Mixed Essay',
  task2_structure: 'Task 2 — Structure Practice',
};

function draftKey(taskId: string) { return `draft:writing:${taskId}`; }
function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.replace(/\n/g, ' ').split(' ').map((s) => s.trim()).filter(Boolean).length;
}

/** 安全複製 */
async function copySafe(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function" &&
        typeof window !== "undefined" &&
        (window.isSecureContext || location.hostname === "localhost")) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function BandBadge({ overall, margin }: { overall?: number; margin?: number }) {
  if (overall == null) return null;
  const value = Number(overall);
  const display = isNaN(value) ? '-' : value.toFixed(1).replace(/\.0$/, '');
  const pct = Math.max(0, Math.min(100, (value / 9) * 100));
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white/70 p-2">
      <div className="text-[11px] text-zinc-600">Overall Band</div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full bg-blue-500/80" style={{ width: `${pct}%` }} aria-label={`overall ${display}/9`} />
        </div>
        <div className="flex items-baseline gap-0.5">
          <div className="text-[13px] font-semibold text-zinc-900">{display}</div>
          {margin != null && (
            <div className="text-[10px] text-zinc-400" title={`±${margin} band margin of error (measured MAE)`}>
              ±{margin}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, compact }: { label: string; value?: number; compact?: boolean }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, (value / 9) * 100));
  return (
    <div className={["flex items-center justify-between rounded-md border border-zinc-200 bg-white/60", compact ? "px-2 py-1.5" : "px-3 py-2"].join(" ")}>
      <div className={compact ? "text-[11px] text-zinc-600" : "text-[12px] text-zinc-600"}>{label}</div>
      <div className="flex items-center gap-2">
        <div className={compact ? "h-1 w-24 overflow-hidden rounded-full bg-zinc-200" : "h-1.5 w-32 overflow-hidden rounded-full bg-zinc-200"}>
          <div className="h-full bg-zinc-700" style={{ width: `${pct}%` }} />
        </div>
        <div className={compact ? "text-[11px] font-medium text-zinc-800" : "text-[12px] font-medium text-zinc-800"}>
          {value.toFixed(1).replace(/\.0$/, '')}
        </div>
      </div>
    </div>
  );
}

function SaveToNotebookBtn({ text, examType }: { text: string; examType: "writing" | "speaking" }) {
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done'>('idle');
  async function save() {
    if (saved !== 'idle') return;
    setSaved('saving');
    try {
      await fetch('/api/notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType,
          dimension: 'grammar',
          original: text,
          correction: text,
          explanation: text,
        }),
      });
      setSaved('done');
    } catch {
      setSaved('idle');
    }
  }
  return (
    <button
      onClick={save}
      disabled={saved !== 'idle'}
      title="加入錯題本"
      className={[
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] transition-colors',
        saved === 'done'
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border border-zinc-200 bg-white text-zinc-400 hover:text-zinc-700 hover:border-zinc-300',
      ].join(' ')}
    >
      {saved === 'done' ? '✓' : '+'}
    </button>
  );
}

function CopyBtn({ text, label, onDone }: { text: string; label: string; onDone?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!text) return;
        const ok = await copySafe(text);
        if (!ok) return;
        setDone(true);
        onDone?.();
        setTimeout(() => setDone(false), 1200);
      }}
      className={[
        'rounded-lg border px-2 py-1 text-[12px]',
        text ? 'border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800' : 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400',
      ].join(' ')}
      disabled={!text}
      aria-live="polite"
    >
      {done ? '已複製 ✓' : label}
    </button>
  );
}
