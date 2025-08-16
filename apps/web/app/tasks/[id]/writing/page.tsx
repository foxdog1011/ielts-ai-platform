'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Toast';

type BandScores = { overall?: number; taskResponse?: number; coherence?: number; lexical?: number; grammar?: number; };
type ParagraphFeedback = { index: number; comment: string };
type SubmitResponse = {
  ok: boolean;
  data?: {
    band?: BandScores | null;
    paragraphFeedback?: ParagraphFeedback[];
    improvements?: string[];
    rewritten?: string;
    tokensUsed?: number;
  };
  error?: { code?: string; message?: string };
  requestId?: string;
};

function getPromptText(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && typeof d.prompt === 'string') return d.prompt;
  if (Array.isArray(d) && d.length) return getPromptText(d[0]);
  return '';
}

export default function WritingTaskPage() {
  const toast = useToast();
  const routeParams = useParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(routeParams?.id) ? routeParams?.id?.[0] : routeParams?.id || '1';
  const searchParams = useSearchParams();
  const qFromUrl = (searchParams?.get('q') || '').trim();

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

  // 初始化題目
  useEffect(() => {
    (async () => {
      if (qFromUrl) { setPrompt(qFromUrl); return; }
      await fetchRandomPrompt();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl]);

  async function fetchRandomPrompt(retryOnce = true) {
    try {
      setLoadingPrompt(true);
      const res = await fetch(`/api/prompts/random?type=writing&part=task2`, { cache: 'no-store' });
      const json = await res.json();
      const text = getPromptText(json?.data);
      if (json?.ok && text) { setPrompt(text); return; }
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
    } catch {
      toast.push('抽題失敗');
    } finally {
      setLoadingPrompt(false);
    }
  }

  // 計時
  useEffect(() => {
    if (essay.trim().length > 0 && !timerRef.current) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  }, [essay]);

  // Autosave
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => {
      localStorage.setItem(draftKey(taskId), essay);
      setSavedAt(Date.now());
    }, 5000);
    return () => clearInterval(t);
  }, [essay, taskId]);

  // 載入草稿
  useEffect(() => {
    const draft = localStorage.getItem(draftKey(taskId));
    if (draft && !essay) setEssay(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // 離頁提醒
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

  // 熱鍵
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

      // 寫入歷史
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'writing',
            taskId,
            prompt,
            durationSec: seconds,
            words,
            band: json.data?.band ?? null,
            ts: Date.now(),
          }),
        });
      } catch {}

      toast.push('已取得評分');
    } catch (e: any) {
      setError(e?.message || '發生未預期錯誤');
      toast.push('送出失敗');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] text-zinc-500 hover:text-zinc-800">← 回首頁</Link>
            <h1 className="text-[18px] font-medium tracking-tight">Writing Task 2</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/evidence/calibration" className="text-[12px] text-blue-600 hover:underline">
              校準曲線
            </Link>
            <button
              onClick={() => fetchRandomPrompt()}
              disabled={loadingPrompt}
              className={[
                'rounded-xl border px-3 py-1.5 text-[12px]',
                loadingPrompt ? 'cursor-wait border-zinc-200 bg-zinc-100 text-zinc-400' : 'border-zinc-300 bg-white hover:bg-zinc-50'
              ].join(' ')}
            >
              {loadingPrompt ? '抽題中…' : '換一題'}
            </button>
            <div className="text-[11px] text-zinc-500">Task #{taskId}</div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.4fr]">
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
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[12px] text-zinc-500">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1">
                    時間 <span className="font-medium text-zinc-800">{minutes}:{sec.toString().padStart(2, '0')}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1">
                    字數 <span className="font-medium text-zinc-800">{words}</span>
                  </span>
                  <span className="hidden sm:inline text-zinc-500">（{wordHint}）</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[12px] text-zinc-500">目標字數</label>
                  <input
                    type="range" min={180} max={350} step={10}
                    value={targetWords}
                    onChange={(e) => { dirtyRef.current = true; setTargetWords(Number(e.target.value)); }}
                    className="w-52 accent-zinc-700"
                  />
                  <span className="text-[12px] text-zinc-700">{targetWords} words</span>
                </div>
              </div>

              <textarea
                className="mt-3 w-full min-h-[300px] rounded-xl border border-zinc-200 bg-white p-4 text-[14px] leading-[1.75] outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="在此撰寫或貼上你的作文……"
                value={essay}
                onChange={(e) => { dirtyRef.current = true; setEssay(e.target.value); }}
              />

              <div className="mt-2 text-[11px] text-zinc-500">
                {savedAt ? <>已自動保存 {new Date(savedAt).toLocaleTimeString()}</> : '將自動保存草稿'}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12px] text-zinc-500">快捷鍵：Ctrl/Cmd+Enter 送出，Esc 清空結果預覽</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEssay(''); localStorage.removeItem(draftKey(taskId)); setSeconds(0); setResult(undefined); }}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    清空草稿
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={submitting || essay.trim().length < 30 || !prompt}
                    className={[
                      'rounded-xl border px-4 py-2 text-sm transition-colors',
                      submitting
                        ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                        : 'border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100',
                    ].join(' ')}
                  >
                    {submitting ? '分析中…' : '送出並取得評分'}
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
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[12px] text-zinc-500">你的原文</div>
                  <div className="mt-1 min-h-[120px] whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed text-zinc-800">
                    {essay || '（尚未輸入）'}
                  </div>
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

          {/* 右側：AI 評分（sticky / 可收合） */}
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-medium tracking-tight">AI 評分</h3>
                <button
                  onClick={() => setShowRight((v) => !v)}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] hover:bg-zinc-50"
                  aria-expanded={showRight}
                >
                  {showRight ? '收合' : '展開'}
                </button>
              </div>

              {!showRight && <div className="mt-2 text-[12px] text-zinc-500">已收合（點「展開」查看詳情）</div>}

              {showRight && (
                <>
                  {!result && <div className="mt-3 text-[12px] text-zinc-500">送出後將顯示整體 Band 與分項評分、建議。</div>}

                  {result?.band && (
                    <div className="mt-3 space-y-2">
                      <BandBadge overall={result.band.overall} />
                      <ScoreRow compact label="Task Response" value={result.band.taskResponse} />
                      <ScoreRow compact label="Coherence & Cohesion" value={result.band.coherence} />
                      <ScoreRow compact label="Lexical Resource" value={result.band.lexical} />
                      <ScoreRow compact label="Grammar Range & Accuracy" value={result.band.grammar} />
                    </div>
                  )}

                  {!!result?.improvements?.length && (
                    <details className="mt-3">
                      <summary className="cursor-pointer list-none text-[12px] font-medium text-zinc-700">改善建議（{result.improvements.length}）</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-zinc-700">
                        {result.improvements.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </details>
                  )}

                  {!!result?.paragraphFeedback?.length && (
                    <details className="mt-3">
                      <summary className="cursor-pointer list-none text-[12px] font-medium text-zinc-700">逐段建議（{result.paragraphFeedback.length}）</summary>
                      <div className="mt-2 space-y-1">
                        {result.paragraphFeedback.map((p) => (
                          <div key={p.index} className="rounded-lg border border-zinc-200 bg-white/70 px-2 py-1.5 text-[12px] leading-relaxed text-zinc-700">
                            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] text-zinc-700">{p.index + 1}</span>
                            {p.comment}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {!!result?.tokensUsed && (
                    <div className="mt-3 text-right text-[11px] text-zinc-500">tokens {result.tokensUsed}</div>
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

function draftKey(taskId: string) { return `draft:writing:${taskId}`; }
function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.replace(/\n/g, ' ').split(' ').map((s) => s.trim()).filter(Boolean).length;
}

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

function BandBadge({ overall }: { overall?: number }) {
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
        <div className="text-[13px] font-semibold text-zinc-900">{display}</div>
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
