// apps/web/app/history/page.tsx
import Link from "next/link";
import { listHistory, type HistoryRecord, type WritingRecord, type SpeakingRecord } from "@/lib/history";

type PageProps = {
  searchParams?: Promise<{
    type?: "writing" | "speaking";
    page?: string;
  }>;
};

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = (params?.type === "writing" || params?.type === "speaking") ? params.type : undefined;
  const page = Math.max(1, Number(params?.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await listHistory({ type, limit: PAGE_SIZE + 1, offset });
  const hasNext = rows.length > PAGE_SIZE;
  const data = rows.slice(0, PAGE_SIZE);

  // Stats from current page data
  const writingRows = data.filter((r) => r.type === "writing");
  const speakingRows = data.filter((r) => r.type === "speaking");

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors">← 回首頁</Link>
            <h1 className="text-[18px] font-semibold tracking-tight">歷史紀錄</h1>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">{data.length} 筆</span>
          </div>
          <TypeTabs active={type} />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12 space-y-6">

        {/* Stats strip */}
        {data.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="本頁 Writing" value={writingRows.length} color="blue" />
            <StatCard label="本頁 Speaking" value={speakingRows.length} color="amber" />
            <StatCard
              label="Writing 均分"
              value={avgBand(writingRows, "writing")}
              color="blue"
              suffix="/9"
            />
            <StatCard
              label="Speaking 均分"
              value={avgBand(speakingRows, "speaking")}
              color="amber"
              suffix="/9"
            />
          </div>
        )}

        {data.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-8 text-center shadow-sm">
            <div className="text-[32px] mb-3">📝</div>
            <div className="text-[15px] text-zinc-600">尚無歷史紀錄</div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-[13px] text-blue-900 hover:bg-blue-100 transition-colors" href="/tasks/1/writing">
                寫一篇 Writing
              </Link>
              <Link className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-[13px] text-amber-900 hover:bg-amber-100 transition-colors" href="/tasks/1/speaking">
                錄一段 Speaking
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.map((rec, i) => (
              <HistoryCard key={i} rec={rec} index={offset + i + 1} />
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/history${buildQS({ type, page: Math.max(1, page - 1) })}`}
            className={[
              "rounded-lg border px-4 py-2 text-[12px] font-medium transition-colors",
              page <= 1
                ? "pointer-events-none cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
                : "border-zinc-300 bg-white hover:bg-zinc-50",
            ].join(" ")}
            aria-disabled={page <= 1}
          >
            ← 上一頁
          </Link>
          <div className="text-[12px] text-zinc-500">Page {page}</div>
          <Link
            href={`/history${buildQS({ type, page: hasNext ? page + 1 : page })}`}
            className={[
              "rounded-lg border px-4 py-2 text-[12px] font-medium transition-colors",
              hasNext
                ? "border-zinc-300 bg-white hover:bg-zinc-50"
                : "pointer-events-none cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400",
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

/* ── components ── */

function TypeTabs({ active }: { active?: "writing" | "speaking" }) {
  const tabs = [
    { key: undefined as undefined | "writing" | "speaking", label: "全部" },
    { key: "writing" as const, label: "Writing" },
    { key: "speaking" as const, label: "Speaking" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {tabs.map((t) => {
        const selected = active === t.key || (!active && t.key === undefined);
        return (
          <Link
            key={`${t.label}-${String(t.key)}`}
            href={`/history${buildQS({ type: t.key, page: 1 })}`}
            className={[
              "rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors",
              selected
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white hover:bg-zinc-50",
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

function StatCard({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: number | string;
  color: "blue" | "amber";
  suffix?: string;
}) {
  const accent = color === "blue" ? "text-blue-700 bg-blue-50 border-blue-200" : "text-amber-700 bg-amber-50 border-amber-200";
  return (
    <div className={`rounded-xl border px-3 py-3 ${accent}`}>
      <div className="text-[11px] text-current opacity-70">{label}</div>
      <div className="mt-0.5 text-[20px] font-bold">
        {value}
        {suffix && <span className="text-[12px] font-normal opacity-60 ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

function HistoryCard({ rec, index }: { rec: HistoryRecord; index: number }) {
  const ts = (rec as any).createdAt ? new Date(String((rec as any).createdAt)) : undefined;
  const when = ts
    ? ts.toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  if (rec.type === "writing") {
    const w = rec as WritingRecord;
    const overall = w.band?.overall;
    const pct = overall ? Math.min(100, (overall / 9) * 100) : 0;
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm hover:border-zinc-300 transition-colors">
        <div className="flex items-start gap-3">
          {/* Number */}
          <div className="shrink-0 w-6 text-[11px] text-zinc-400 pt-0.5 text-right">#{index}</div>

          {/* Type badge */}
          <div className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">W</div>

          <div className="flex-1 min-w-0">
            {/* Prompt */}
            {w.prompt && (
              <p className="line-clamp-1 text-[13px] text-zinc-700 font-medium">{w.prompt}</p>
            )}

            {/* Band scores */}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {/* Overall badge */}
              {overall != null && (
                <div className="flex items-center gap-2">
                  <span className="text-[22px] font-bold text-zinc-900">
                    {overall.toFixed(1).replace(/\.0$/, "")}
                  </span>
                  <div className="text-[11px] text-zinc-400 leading-tight">
                    <div>/9</div>
                    <div>Overall</div>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {overall != null && (
                <div className="flex-1 min-w-[80px] max-w-[160px]">
                  <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Sub-scores */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { k: "Task", v: w.band?.taskResponse },
                  { k: "Coh.", v: w.band?.coherence },
                  { k: "Lex.", v: w.band?.lexical },
                  { k: "Gram.", v: w.band?.grammar },
                ].map(({ k, v }) =>
                  v != null ? (
                    <span
                      key={k}
                      className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-600"
                    >
                      {k} <span className="font-semibold text-zinc-900">{v.toFixed(1).replace(/\.0$/, "")}</span>
                    </span>
                  ) : null,
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-zinc-400">
              {when && <span>{when}</span>}
              {w.words && <span>{w.words} words</span>}
              {w.durationSec && <span>{fmtSec(w.durationSec)}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Speaking
  const s = rec as SpeakingRecord;
  const overall = s.band?.overall ?? s.band?.content;
  const pct = overall ? Math.min(100, (overall / 9) * 100) : 0;
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm hover:border-zinc-300 transition-colors">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-6 text-[11px] text-zinc-400 pt-0.5 text-right">#{index}</div>
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">S</div>

        <div className="flex-1 min-w-0">
          {s.prompt && (
            <p className="line-clamp-1 text-[13px] text-zinc-700 font-medium">{s.prompt}</p>
          )}

          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {overall != null && (
              <div className="flex items-center gap-2">
                <span className="text-[22px] font-bold text-zinc-900">
                  {overall.toFixed(1).replace(/\.0$/, "")}
                </span>
                <div className="text-[11px] text-zinc-400 leading-tight">
                  <div>/9</div>
                  <div>Overall</div>
                </div>
              </div>
            )}

            {overall != null && (
              <div className="flex-1 min-w-[80px] max-w-[160px]">
                <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-1.5 flex-wrap">
              {[
                { k: "Content", v: s.band?.content },
                { k: "Grammar", v: s.band?.grammar },
                { k: "Vocab", v: s.band?.vocab },
                { k: "Fluency", v: s.band?.fluency },
                { k: "Pronun.", v: s.band?.pronunciation },
              ].map(({ k, v }) =>
                v != null ? (
                  <span
                    key={k}
                    className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-600"
                  >
                    {k} <span className="font-semibold text-zinc-900">{v.toFixed(1).replace(/\.0$/, "")}</span>
                  </span>
                ) : null,
              )}
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-zinc-400">
            {when && <span>{when}</span>}
            {s.durationSec && <span>{fmtSec(s.durationSec)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */

function avgBand(rows: HistoryRecord[], type: "writing" | "speaking"): string {
  const vals = rows
    .map((r: any) =>
      type === "writing" ? r.band?.overall : (r.band?.overall ?? r.band?.content),
    )
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (!vals.length) return "—";
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
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
