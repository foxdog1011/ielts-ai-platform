'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';

type EvalResp = {
  ok: boolean;
  requestId?: string;
  data?: {
    transcript?: string;
    band?: { overall?: number; content?: number; grammar?: number; vocab?: number; fluency?: number; pronunciation?: number };
    speakingFeatures?: Record<string, number | string | boolean>;
    feedback?: string;
    tokensUsed?: number;
    debug?: Record<string, unknown>;
  };
  error?: { message: string };
};

function getPromptText(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && typeof d.prompt === 'string') return d.prompt;
  if (Array.isArray(d) && d.length) return getPromptText(d[0]);
  return '';
}

export default function SpeakingPage() {
  const toast = useToast();
  const routeParams = useParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(routeParams?.id) ? routeParams?.id?.[0] : routeParams?.id || '1';
  const searchParams = useSearchParams();
  const qFromUrl = (searchParams?.get('q') || '').trim();

  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // 錄音
  const [recState, setRecState] = useState<'idle'|'recording'|'finished'>('idle');
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
      const res = await fetch(`/api/prompts/random?type=speaking&part=part2`, { cache: 'no-store' });
      const json = await res.json();
      const text = getPromptText(json?.data);
      if (json?.ok && text) { setPrompt(text); return; }
      if (retryOnce) {
        await fetch('/api/prompts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'speaking', part: 'part2', count: 10 }),
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

  // 錄音
  async function startRec() {
    setResp(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
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

  function resetRec() {
    setRecState('idle');
    setDurationSec(0);
    setResp(undefined);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    setManualTranscript('');
  }

  // 送審
  async function submit() {
    if (!audioUrl && !manualTranscript.trim()) {
      toast.push('請先錄音或填寫逐字稿');
      return;
    }
    setSubmitting(true);
    setResp(undefined);
    try {
      let serverAudioPath = "";

      // 若前端有錄音，先上傳到 /api/upload-audio 換成伺服器檔案路徑
      if (audioUrl) {
        const blob = await (await fetch(audioUrl)).blob();
        const mime = blob.type || 'audio/webm';
        const buf = await blob.arrayBuffer();
        // 將 binary 轉 base64
        let binary = '';
        const bytes = new Uint8Array(buf);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
        const audioBase64 = btoa(binary);

        const up = await fetch('/api/upload-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, mime }),
        }).then(r => r.json());

        if (!up?.ok || !up?.data?.path) throw new Error(up?.error?.message || '上傳失敗');
        serverAudioPath = up.data.path;
      }

      // 呼叫後端評分（沿用既有 /api/speaking 接口，吃 audioPath）
      const res = await fetch('/api/speaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          prompt,
          audioPath: serverAudioPath || undefined,
          transcript: manualTranscript.trim() || undefined,
        }),
      });
      const json: EvalResp = await res.json();
      if (!json.ok) throw new Error(json?.error?.message || '分析失敗');
      setResp(json.data);
      toast.push('已取得評分');

      // 寫入歷史
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'speaking',
            taskId,
            prompt,
            durationSec: Math.max(1, durationSec),
            band: {
              overall: json.data?.band?.overall,
              content: json.data?.band?.content,
              speech: json.data?.band?.overall, // 保留 overall 以利首頁摘要
            },
            ts: Date.now(),
          }),
        });
      } catch {}
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
            <Link href="/" className="text-[13px] text-zinc-500 hover:text-zinc-800">← 回首頁</Link>
            <h1 className="text-[18px] font-medium tracking-tight">Speaking（Part 2）</h1>
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
                  onClick={resetRec}
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
              <h3 className="text-[13px] font-medium tracking-tight">AI 評分</h3>

              {!resp && (
                <div className="mt-3 text-[12px] text-zinc-500">
                  送出後將顯示內容面（Content/Grammar/Vocab）與語音面（Pronunciation/Fluency）的分數與建議。
                </div>
              )}

              {resp?.band && (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-white/70 p-3">
                  <div className="text-[12px] font-medium">Scores</div>
                  <div className="mt-1 grid gap-1 text-[12px] text-zinc-700">
                    <Score label="Overall" v={resp.band.overall} />
                    <Score label="Content" v={resp.band.content} />
                    <Score label="Grammar" v={resp.band.grammar} />
                    <Score label="Vocabulary" v={resp.band.vocab} />
                    <Score label="Fluency" v={resp.band.fluency} />
                    <Score label="Pronunciation" v={resp.band.pronunciation} />
                  </div>
                </div>
              )}

              {resp?.speakingFeatures && (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-white/70 p-3">
                  <div className="text-[12px] font-medium">Speaking features</div>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-zinc-600">
                    {[
                      ["duration_s","Duration","s"],
                      ["wpm","WPM",""],
                      ["articulation_wpm","Artic WPM",""],
                      ["pause_ratio","Pause ratio",""],
                      ["pause_count_ge300ms","Pauses (≥300ms)",""],
                      ["avg_pause_s","Avg pause (s)","s"],
                      ["filler_per_100w","Filler / 100w",""],
                      ["self_repair_per_100w","Self-repair / 100w",""],
                      ["f0_std_hz","F0 std (Hz)","Hz"],
                      ["energy_std","Energy std",""],
                    ].map(([k, label, unit]) => (
                      <Metric key={k} label={label} v={fmtVal(resp.speakingFeatures?.[k as keyof typeof resp.speakingFeatures], unit)} />
                    ))}
                  </div>
                </div>
              )}

              {!!resp?.feedback && (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-white/70 p-3">
                  <div className="text-[12px] font-medium">Feedback</div>
                  <div className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800">
                    {resp.feedback}
                  </div>
                </div>
              )}

              {!!resp?.tokensUsed && (
                <div className="mt-3 text-right text-[11px] text-zinc-500">tokens {resp.tokensUsed}</div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Score({ label, v }: { label: string; v?: number }) {
  if (v == null) return null;
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-medium text-zinc-900">{Number(v).toFixed(1).replace(/\.0$/, '')}</span>
    </div>
  );
}
function Metric({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="text-zinc-800">{v}</span>
    </div>
  );
}
function fmtVal(v: any, unit?: string) {
  if (v == null) return "-";
  if (typeof v === "number") {
    const s = Number.isFinite(v) ? v.toFixed(2).replace(/\.00$/, "") : "-";
    return unit ? `${s}${s !== "-" ? unit : ""}` : s;
  }
  return String(v);
}
