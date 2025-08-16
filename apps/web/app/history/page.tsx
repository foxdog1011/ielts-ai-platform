// apps/web/app/history/page.tsx
import Link from "next/link";
import { listHistory, type HistoryRecord, type WritingRecord, type SpeakingRecord } from "@/lib/history";

type PageProps = {
  searchParams?: {
    type?: "writing" | "speaking";
    page?: string; // 1-based
  };
};

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic"; // 確保每次請求都打到 KV

export default async function HistoryPage({ searchParams }: PageProps) {
  const type = (searchParams?.type === "writing" || searchParams?.type === "speaking") ? searchParams!.type : undefined;
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // 取 PAGE_SIZE+1 來決定是否有下一頁
  const rows = await listHistory({ type, limit: PAGE_SIZE + 1, offset });
  const hasNext = rows.length > PAGE_SIZE;
  const data = rows.slice(0, PAGE_SIZE);

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] text-zinc-500 hover:text-zinc-800">← 回首頁</Link>
            <h1 className="text-[18px] font-medium tracking-tight">History</h1>
          </div>
          <TypeTabs active={type}/>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12">
        {data.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 text-[14px] text-zinc-600 shadow-sm">
            尚無歷史紀錄。去{" "}
            <Link className="text-blue-700 hover:underline" href="/tasks/1/writing">寫一篇 Writing</Link>
            {" "}或{" "}
            <Link className="text-amber-700 hover:underline" href="/tasks/1/speaking">錄一段 Speaking</Link>
            {" "}試試！
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((rec, i) => (
              <HistoryCard key={i} rec={rec}/>
            ))}
          </div>
        )}

        {/* 分頁 */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            href={`/history${buildQS({ type, page: Math.max(1, page - 1) })}`}
            className={[
              "rounded-lg border px-3 py-1.5 text-[12px]",
              page <= 1 ? "pointer-events-none cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400" : "border-zinc-300 bg-white hover:bg-zinc-50"
            ].join(" ")}
            aria-disabled={page <= 1}
          >
            ← 上一頁
          </Link>
          <div className="text-[12px] text-zinc-500">Page {page}</div>
          <Link
            href={`/history${buildQS({ type, page: hasNext ? page + 1 : page })}`}
            className={[
              "rounded-lg border px-3 py-1.5 text-[12px]",
              hasNext ? "border-zinc-300 bg-white hover:bg-zinc-50" : "pointer-events-none cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
            ].join(" ")}
            aria-disabled={!hasNext}
          >
            下一頁 →
          </Link>
        </div>
      </section>
    </main>
  );
}

function TypeTabs({ active }: { active?: "writing" | "speaking" }) {
  const tabs = [
    { key: undefined as undefined | "writing" | "speaking", label: "All" },
    { key: "writing" as const, label: "Writing" },
    { key: "speaking" as const, label: "Speaking" },
  ];
  return (
    <div className="flex items-center gap-2">
      {tabs.map((t) => {
        const selected = active === t.key || (!active && t.key === undefined);
        return (
          <Link key={`${t.label}-${String(t.key)}`} href={`/history${buildQS({ type: t.key, page: 1 })}`}
            className={[
              "rounded-xl border px-3 py-1.5 text-[12px]",
              selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:bg-zinc-50"
            ].join(" ")}
            aria-current={selected ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function HistoryCard({ rec }: { rec: HistoryRecord }) {
  const ts = (rec as any).createdAt ? new Date(String((rec as any).createdAt)) : undefined;
  const when = ts ? ts.toLocaleString() : "";

  if (rec.type === "writing") {
    const w = rec as WritingRecord;
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-[12px] font-medium text-blue-700">Writing</div>
            {w.prompt && <div className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-zinc-900">{w.prompt}</div>}
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-zinc-600 sm:grid-cols-4">
              <div>Task: <b className="text-zinc-900">{w.taskId}</b></div>
              <div>Duration: <b className="text-zinc-900">{fmtSec(w.durationSec)}</b></div>
              <div>Words: <b className="text-zinc-900">{w.words ?? "-"}</b></div>
              <div>When: <b className="text-zinc-900">{when || "-"}</b></div>
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-5">
              <Badge label="Overall" val={w.band?.overall}/>
              <Badge label="Task Resp." val={w.band?.taskResponse}/>
              <Badge label="Coherence" val={w.band?.coherence}/>
              <Badge label="Lexical" val={w.band?.lexical}/>
              <Badge label="Grammar" val={w.band?.grammar}/>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // speaking
  const s = rec as SpeakingRecord;
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-[12px] font-medium text-amber-700">Speaking</div>
          {s.prompt && <div className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-zinc-900">{s.prompt}</div>}
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-zinc-600 sm:grid-cols-4">
            <div>Task: <b className="text-zinc-900">{s.taskId}</b></div>
            <div>Duration: <b className="text-zinc-900">{fmtSec(s.durationSec)}</b></div>
            <div>When: <b className="text-zinc-900">{when || "-"}</b></div>
          </div>
          <div className="mt-2 grid gap-1 sm:grid-cols-6">
            <Badge label="Overall" val={s.band?.overall}/>
            <Badge label="Content" val={s.band?.content}/>
            <Badge label="Grammar" val={s.band?.grammar}/>
            <Badge label="Vocab" val={s.band?.vocab}/>
            <Badge label="Fluency" val={s.band?.fluency}/>
            <Badge label="Pronunciation" val={s.band?.pronunciation}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ label, val }: { label: string; val?: number }) {
  if (val == null || Number.isNaN(val)) return (
    <div className="rounded-lg border border-zinc-200 bg-white/60 px-2 py-1 text-[12px] text-zinc-500">{label}: -</div>
  );
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white/70 px-2 py-1 text-[12px]">
      <span className="text-zinc-600">{label}</span>
      <span className="font-medium text-zinc-900">{val.toFixed(1).replace(/\.0$/, "")}</span>
    </div>
  );
}

function fmtSec(s?: number) {
  if (!s || !Number.isFinite(s)) return "-";
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function buildQS({ type, page }: { type?: "writing" | "speaking"; page?: number }) {
  const qp = new URLSearchParams();
  if (type) qp.set("type", type);
  if (page && page > 1) qp.set("page", String(page));
  const s = qp.toString();
  return s ? `?${s}` : "";
}
