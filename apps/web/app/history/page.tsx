// apps/web/app/history/page.tsx
import { listHistory, type AnyHistory, type WritingHistory, type SpeakingHistory } from "../../lib/history";
import Link from "next/link";

export default async function HistoryPage() {
  const rows = await listHistory({ limit: 50, offset: 0 });

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] text-zinc-500 hover:text-zinc-800">← 回首頁</Link>
            <h1 className="text-[18px] font-medium tracking-tight">歷史紀錄</h1>
          </div>
          <div className="text-[12px] text-zinc-500">{rows.length} 筆</div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
          <table className="w-full table-auto text-left">
            <thead>
              <tr className="text-[12px] text-zinc-500">
                <th className="py-2 pr-3 font-normal">時間</th>
                <th className="py-2 pr-3 font-normal">類型</th>
                <th className="py-2 pr-3 font-normal">Task</th>
                <th className="py-2 pr-3 font-normal">題目</th>
                <th className="py-2 pr-3 font-normal">指標</th>
                <th className="py-2 font-normal text-right">Overall</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-200 text-[13px]">
                  <td className="py-2 pr-3 text-zinc-600">{fmtTime(r.ts)}</td>
                  <td className="py-2 pr-3">{r.type === "writing" ? "Writing" : "Speaking"}</td>
                  <td className="py-2 pr-3 text-zinc-600">#{r.taskId}</td>
                  <td className="py-2 pr-3 max-w-[32rem] truncate" title={r.prompt}>{r.prompt}</td>
                  <td className="py-2 pr-3 text-zinc-700">{renderMetrics(r)}</td>
                  <td className="py-2 pl-3 text-right font-medium text-zinc-900">{fmtOverall(r)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[13px] text-zinc-500">
                    尚無歷史紀錄。先到 Writing 或 Speaking 完成一次練習吧！
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function renderMetrics(r: AnyHistory) {
  if (r.type === "writing") {
    const w = r as WritingHistory;
    const mins = Math.max(1, Math.round(w.durationSec / 60));
    const wpm = Math.round((w.words || 0) / mins);
    return (
      <span className="inline-flex flex-wrap gap-2">
        <Badge>字數 {w.words}</Badge>
        <Badge>時間 {mins}m</Badge>
        <Badge>WPM {wpm}</Badge>
      </span>
    );
  } else {
    const s = r as SpeakingHistory;
    const mins = Math.max(1, Math.round(s.durationSec / 60));
    const content = s.band?.content != null ? s.band.content.toFixed(1).replace(/\.0$/, "") : "-";
    const speech  = s.band?.speech  != null ? s.band.speech.toFixed(1).replace(/\.0$/, "")  : "-";
    return (
      <span className="inline-flex flex-wrap gap-2">
        <Badge>時間 {mins}m</Badge>
        <Badge>Content {content}</Badge>
        <Badge>Speech {speech}</Badge>
      </span>
    );
  }
}

function fmtOverall(r: AnyHistory) {
  const ov =
    r.type === "writing"
      ? r.band?.overall
      : (r.band?.overall ?? r.band?.content); // speaking 若沒 overall，用 content 代顯
  if (ov == null || isNaN(ov)) return "-";
  return Number(ov).toFixed(1).replace(/\.0$/, "");
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[12px] text-zinc-700">
      {children}
    </span>
  );
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
