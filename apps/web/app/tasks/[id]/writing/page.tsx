'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type BandScores = { overall?: number; taskResponse?: number; coherence?: number; lexical?: number; grammar?: number; };
type ParagraphFeedback = { index: number; comment: string };
type SubmitResponse = {
  ok: boolean;
  data?: { band?: BandScores | null; paragraphFeedback?: ParagraphFeedback[]; improvements?: string[]; rewritten?: string; tokensUsed?: number; };
  error?: { code: string; message: string };
  requestId?: string;
};

export default function WritingTaskPage() {
  const routeParams = useParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(routeParams?.id) ? routeParams?.id?.[0] : routeParams?.id || '1';

  const [prompt, setPrompt] = useState<string>('Some people think that...');
  const [essay, setEssay] = useState<string>('');
  const [targetWords, setTargetWords] = useState<number>(250);
  const [seconds, setSeconds] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<SubmitResponse['data']>();

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (essay.trim().length > 0 && !timerRef.current) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  }, [essay]);

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
    } catch (e: any) {
      setError(e?.message || '發生未預期錯誤');
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
          <div className="text-[11px] text-zinc-500">Task #{taskId}</div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Editor Panel */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[12px] text-zinc-500">題目</label>
              <div className="flex items-center gap-3 text-[12px] text-zinc-500">
                <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1">
                  時間 <span className="font-medium text-zinc-800">{minutes}:{sec.toString().padStart(2, '0')}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1">
                  字數 <span className="font-medium text-zinc-800">{words}</span>
                </span>
              </div>
            </div>

            <textarea
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-[13px] leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-zinc-300"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-[12px] text-zinc-500">目標字數</label>
              <input type="range" min={180} max={350} step={10}
                value={targetWords} onChange={(e) => setTargetWords(Number(e.target.value))}
                className="w-52 accent-zinc-700" />
              <span className="text-[12px] text-zinc-700">{targetWords} words</span>
              <span className="text-[12px] text-zinc-500">（{wordHint}）</span>
            </div>

            <div className="mt-4">
              <label className="text-[12px] text-zinc-500">你的作文</label>
              <textarea
                className="mt-2 w-full min-h-[240px] rounded-xl border border-zinc-200 bg-white p-4 text-[14px] leading-relaxed outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="在此撰寫或貼上你的作文……"
                value={essay}
                onChange={(e) => setEssay(e.target.value)}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px] text-zinc-500">我們不會儲存你的內容，請避免個資。</div>
              <button
                onClick={onSubmit}
                disabled={submitting || essay.trim().length < 30}
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

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Result Panel */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-medium tracking-tight">AI 評分</h3>
              {!!result?.tokensUsed && <span className="text-[11px] text-zinc-500">tokens {result.tokensUsed}</span>}
            </div>

            {!result && (
              <div className="mt-4 text-[13px] text-zinc-500">
                送出後將顯示整體 Band 與分項評分、建議與優化版本。
              </div>
            )}

            {result?.band && (
              <div className="mt-4 space-y-3">
                <BandBadge overall={result.band.overall} />
                <ScoreRow label="Task Response" value={result.band.taskResponse} />
                <ScoreRow label="Coherence & Cohesion" value={result.band.coherence} />
                <ScoreRow label="Lexical Resource" value={result.band.lexical} />
                <ScoreRow label="Grammar Range & Accuracy" value={result.band.grammar} />
              </div>
            )}

            {!!result?.improvements?.length && (
              <div className="mt-6">
                <div className="text-[12px] font-medium text-zinc-700">改善建議</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-zinc-700">
                  {result.improvements.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {!!result?.paragraphFeedback?.length && (
              <div className="mt-6">
                <div className="text-[12px] font-medium text-zinc-700">逐段建議</div>
                <div className="mt-2 space-y-2">
                  {result.paragraphFeedback.map((p) => (
                    <div key={p.index}
                      className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[13px] leading-relaxed text-zinc-700">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] text-zinc-700">
                        {p.index + 1}
                      </span>
                      {p.comment}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compare Panel */}
        <div className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-medium tracking-tight">原文 vs. 優化版本</h3>
            <div className="flex items-center gap-2">
              <CopyBtn text={essay} label="複製原文" />
              <CopyBtn text={result?.rewritten || ''} label="複製優化稿" />
            </div>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-[12px] text-zinc-500">你的原文</div>
              <div className="mt-1 rounded-xl border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed text-zinc-800 min-h-[120px] whitespace-pre-wrap">
                {essay || '（尚未輸入）'}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-zinc-500">AI 優化版本</div>
              <div className="mt-1 rounded-xl border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed text-zinc-800 min-h-[120px] whitespace-pre-wrap">
                {result?.rewritten || '（送出後顯示）'}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.replace(/\n/g, ' ').split(' ').map((s) => s.trim()).filter(Boolean).length;
}
function BandBadge({ overall }: { overall?: number }) {
  if (overall == null) return null;
  const value = Number(overall);
  const display = isNaN(value) ? '-' : value.toFixed(1).replace(/\.0$/, '');
  const pct = Math.max(0, Math.min(100, (value / 9) * 100));
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white/70 p-3">
      <div className="text-[12px] text-zinc-600">Overall Band</div>
      <div className="flex items-center gap-3">
        <div className="h-2 w-40 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full bg-blue-500/80" style={{ width: `${pct}%` }} aria-label={`overall ${display}/9`} />
        </div>
        <div className="text-[14px] font-semibold text-zinc-900">{display}</div>
      </div>
    </div>
  );
}
function ScoreRow({ label, value }: { label: string; value?: number }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, (value / 9) * 100));
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white/60 px-3 py-2">
      <div className="text-[12px] text-zinc-600">{label}</div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full bg-zinc-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[12px] font-medium text-zinc-800">{value.toFixed(1).replace(/\.0$/, '')}</div>
      </div>
    </div>
  );
}
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setDone(true);
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
