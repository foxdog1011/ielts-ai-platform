import Link from "next/link";
import { getHistory, WritingHistory, SpeakingHistory } from "../../../lib/history";

export default async function HistoryPage() {
  const writings = (await getHistory("writing", 100)) as WritingHistory[];
  const speakings = (await getHistory("speaking", 100)) as SpeakingHistory[];

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-10 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[12px] text-zinc-500 hover:text-zinc-800">← 回首頁</Link>
            <h1 className="text-[18px] font-medium tracking-tight">History</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12 space-y-8">
        {/* Writing */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium tracking-tight">Writing</h2>
            <span className="text-[12px] text-zinc-500">{writings.length} records</span>
          </div>

          <div className="mt-4">
            <TrendChart
              title="Writing Overall Band"
              values={writings.map((w) => Number(w.band?.overall ?? 0))}
              min={0}
              max={9}
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="text-zinc-500">
                <tr className="text-left">
                  <th className="py-2 pr-4">時間</th>
                  <th className="py-2 pr-4">Task</th>
                  <th className="py-2 pr-4">Overall</th>
                  <th className="py-2 pr-4">TR</th>
                  <th className="py-2 pr-4">CC</th>
                  <th className="py-2 pr-4">LR</th>
                  <th className="py-2 pr-4">GRA</th>
                  <th className="py-2 pr-4">Words</th>
                  <th className="py-2 pr-4">WPM</th>
                </tr>
              </thead>
              <tbody className="text-zinc-800">
                {writings.map((w) => (
                  <tr key={w.id} className="border-t border-zinc-200/70">
                    <td className="py-2 pr-4">{fmtTime(w.ts)}</td>
                    <td className="py-2 pr-4">#{w.taskId}</td>
                    <td className="py-2 pr-4">{bandFmt(w.band?.overall)}</td>
                    <td className="py-2 pr-4">{bandFmt(w.band?.taskResponse)}</td>
                    <td className="py-2 pr-4">{bandFmt(w.band?.coherence)}</td>
                    <td className="py-2 pr-4">{bandFmt(w.band?.lexical)}</td>
                    <td className="py-2 pr-4">{bandFmt(w.band?.grammar)}</td>
                    <td className="py-2 pr-4">{w.words ?? "—"}</td>
                    <td className="py-2 pr-4">{w.wpm ?? "—"}</td>
                  </tr>
                ))}
                {writings.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-zinc-500">尚無資料，先去寫一篇吧！</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Speaking */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium tracking-tight">Speaking</h2>
            <span className="text-[12px] text-zinc-500">{speakings.length} records</span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TrendChart
              title="Content Overall"
              values={speakings.map((s) => Number(s.bandContent?.overall ?? 0))}
              min={0}
              max={9}
            />
            <TrendChart
              title="Speech Overall"
              values={speakings.map((s) => Number(s.bandSpeech?.overall ?? 0))}
              min={0}
              max={9}
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="text-zinc-500">
                <tr className="text-left">
                  <th className="py-2 pr-4">時間</th>
                  <th className="py-2 pr-4">Task</th>
                  <th className="py-2 pr-4">Content</th>
                  <th className="py-2 pr-4">Speech</th>
                  <th className="py-2 pr-4">WPM</th>
                  <th className="py-2 pr-4">PauseRate</th>
                  <th className="py-2 pr-4">AvgPause</th>
                </tr>
              </thead>
              <tbody className="text-zinc-800">
                {speakings.map((s) => (
                  <tr key={s.id} className="border-top border-zinc-200/70">
                    <td className="py-2 pr-4">{fmtTime(s.ts)}</td>
                    <td className="py-2 pr-4">#{s.taskId}</td>
                    <td className="py-2 pr-4">{bandFmt(s.bandContent?.overall)}</td>
                    <td className="py-2 pr-4">{bandFmt(s.bandSpeech?.overall)}</td>
                    <td className="py-2 pr-4">{s.metrics?.wpm ?? "—"}</td>
                    <td className="py-2 pr-4">{pctFmt(s.metrics?.pauseRate)}</td>
                    <td className="py-2 pr-4">{s.metrics?.avgPauseSec != null ? `${s.metrics.avgPauseSec.toFixed(2)}s` : "—"}</td>
                  </tr>
                ))}
                {speakings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-zinc-500">尚無資料，先去錄一次吧！</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---- 小工具 & 簡易走勢圖（原生 SVG） ---- */
function fmtTime(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}
function bandFmt(n?: number) {
  if (n == null) return "—";
  const s = Number(n).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
function pctFmt(n?: number | null) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function TrendChart({ title, values, min, max }: { title: string; values: number[]; min: number; max: number }) {
  const W = 620, H = 140, P = 18;
  const n = values.length;
  const xs = values.map((_, i) => (n <= 1 ? P : P + (i * (W - 2 * P)) / (n - 1)));
  const ys = values.map((v) => {
    const t = (v - min) / Math.max(1e-6, max - min);
    return H - P - t * (H - 2 * P);
  });
  const path = n
    ? xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ")
    : "";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/70 p-4">
      <div className="text-[12px] font-medium text-zinc-700">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full h-40">
        {/* grid */}
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(0,0,0,0.08)" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="rgba(0,0,0,0.08)" />
        {/* path */}
        {n > 0 && (
          <>
            <path d={path} fill="none" stroke="rgba(24,24,27,0.85)" strokeWidth="2" />
            {xs.map((x, i) => (
              <circle key={i} cx={x} cy={ys[i]} r="2.5" fill="rgba(24,24,27,0.85)" />
            ))}
          </>
        )}
        {n === 0 && <text x={P} y={H/2} fontSize="12" fill="#999">No data</text>}
      </svg>
    </div>
  );
}
