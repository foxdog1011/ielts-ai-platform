'use client';

import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { StudyPlanBlock, type StudyPlan } from '@/components/StudyPlanBlock';
import { CoachBlock, type CoachSnapshotData } from '@/components/CoachBlock';
import { getPromptText } from '@/lib/promptUtils';

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

export default function SpeakingPage() {
  const toast = useToast();
  const router = useRouter();
  const routeParams = useParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(routeParams?.id) ? routeParams?.id?.[0] : routeParams?.id || '1';
  const searchParams = useSearchParams();
  const qFromUrl = (searchParams?.get('q') || '').trim();
  const resetFlag = (searchParams?.get('reset') || '').trim() === '1';

  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);

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
  }, [qFromUrl, taskId]);

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
    try {
      // 1) 直接抽
      const r1 = await tryRandom();
      if (r1) return;

      // 2) 無 → 先種子
      await fetch('/api/prompts/seed', { method: 'POST' });
      const r2 = await tryRandom();
      if (r2) return;

      // 3) 再無 → 生成一批
      await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'speaking', part: 'part2', count: 8 }),
      });
      const r3 = await tryRandom();
      if (r3) return;

      toast.push('暫無題目可抽，稍後再試');
    } catch {
      toast.push('抽題失敗');
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function tryRandom(): Promise<boolean> {
    const res = await fetch(`/api/prompts/random?type=speaking&part=part2`, { cache: 'no-store' });
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
          audioBase64,
          mime,
          durationSec: Math.max(1, durationSec),
          manualTranscript: manualTranscript.trim() || undefined,
          // speechMetrics: { pauseRate: 0.12, avgPauseSec: 0.45 }, //（可選）若你前端有做停頓分析
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
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] text-zinc-500 hover:text-zinc-800">
              ← 回首頁
            </Link>
            <h1 className="text-[18px] font-medium tracking-tight">Speaking（Part 2）</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRandomPrompt()}
              disabled={loadingPrompt}
              className={[
                'rounded-xl border px-3 py-1.5 text-[12px]',
                loadingPrompt
                  ? 'cursor-wait border-zinc-200 bg-zinc-100 text-zinc-400'
                  : 'border-zinc-300 bg-white hover:bg-zinc-50',
              ].join(' ')}
            >
              {loadingPrompt ? '抽題中…' : '換一題'}
            </button>
            <button
              onClick={() => resetAll(true)}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-[12px] hover:bg-zinc-50"
              title="清空錄音/稿/結果並重新開始"
            >
              開始新一輪
            </button>
            <div className="text-[11px] text-zinc-500">Task #{taskId}</div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* 左側：題目 + 錄音 */}
          <div className="space-y-6">
            {/* 題目卡 */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
              <div className="text-[12px] font-medium tracking-wide text-amber-700">CUE CARD</div>
              {loadingPrompt ? (
                <div className="mt-2 h-16 animate-pulse rounded-xl bg-zinc-100" />
              ) : (
                <div className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7] text-zinc-900">
                  {prompt || '（尚未取得題目）'}
                </div>
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
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="text-[14px] font-medium">兩分鐘口說</div>
                <div className="rounded-lg border border-zinc-200 px-2 py-1 text-[12px] text-zinc-700">
                  計時 {mm}:{ss}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {recState !== 'recording' ? (
                  <button
                    onClick={startRec}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100"
                  >
                    開始錄音
                  </button>
                ) : (
                  <button
                    onClick={stopRec}
                    className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 hover:bg-red-100"
                  >
                    停止
                  </button>
                )}
                <button
                  onClick={() => resetAll(true)}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  重新開始
                </button>
                {audioUrl && <audio className="mt-2 block w-full" controls src={audioUrl} />}
              </div>

              {/* 人工逐字稿（可選） */}
              <div className="mt-4">
                <div className="text-[12px] text-zinc-500">若想跳過自動轉寫，可直接貼上逐字稿：</div>
                <textarea
                  className="mt-2 w-full min-h-[100px] rounded-xl border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-zinc-300"
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
                    'rounded-xl border px-4 py-2 text-sm transition-colors',
                    submitting
                      ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                      : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
                  ].join(' ')}
                >
                  {submitting ? '分析中…' : '送出並取得評分'}
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
