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
    <main className="relative min-h-dvh bg-[var(--bg)] text-[var(--text)] font-brand">
      <header className="mx-auto max-w-6xl px-4 sm:px-8 pt-6 sm:pt-8 pb-4 animate-fade-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[14px] sm:text-[13px] text-[var(--text-muted)] hover:text-[var(--color-primary)] theme-transition min-h-[44px] flex items-center">&larr; Home</Link>
            <h1 className="text-[18px] font-semibold tracking-tight">History</h1>
            <span className="rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)] px-2.5 py-0.5 text-[12px] sm:text-[11px] font-medium">{data.length} records</span>
          </div>
          <div className="flex items-center gap-2">
            <TypeTabs active={type} />
            <Link
              href={`/api/export?type=${type ?? "all"}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:py-1.5 min-h-[44px] flex items-center text-[13px] sm:text-[12px] hover:border-[var(--color-primary-200)] hover:text-[var(--color-primary)] theme-transition"
              title="Export CSV"
            >
              CSV
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 sm:px-8 pb-12 space-y-6">

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
          <div className="glass-card p-8 text-center animate-fade-up">
            <div className="text-[32px] mb-3">📝</div>
            <div className="text-[15px] text-[var(--text-secondary)]">No history yet</div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link className="btn-primary" href="/tasks/1/writing">
                Start Writing
              </Link>
              <Link className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-[13px] text-amber-900 hover:bg-amber-100 theme-transition" href="/tasks/1/speaking">
                Start Speaking
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
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
              "rounded-xl border px-4 py-2.5 sm:py-2 min-h-[44px] text-[13px] sm:text-[12px] font-medium theme-transition",
              page <= 1
                ? "pointer-events-none cursor-not-allowed border-[var(--border)] bg-[var(--surface)] text-[var(--text-faint)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--color-primary-200)] hover:text-[var(--color-primary)]",
            ].join(" ")}
            aria-disabled={page <= 1}
          >
            &larr; Previous
          </Link>
          <div className="text-[12px] text-[var(--text-muted)]">Page {page}</div>
          <Link
            href={`/history${buildQS({ type, page: hasNext ? page + 1 : page })}`}
            className={[
              "rounded-xl border px-4 py-2.5 sm:py-2 min-h-[44px] text-[13px] sm:text-[12px] font-medium theme-transition",
              hasNext
                ? "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--color-primary-200)] hover:text-[var(--color-primary)]"
                : "pointer-events-none cursor-not-allowed border-[var(--border)] bg-[var(--surface)] text-[var(--text-faint)]",
            ].join(" ")}
            aria-disabled={!hasNext}
          >
            Next &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}

/* ── components ── */

function TypeTabs({ active }: { active?: "writing" | "speaking" }) {
  const tabs = [
    { key: undefined as undefined | "writing" | "speaking", label: "All" },
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
              "rounded-xl border px-3 py-2 sm:py-1.5 min-h-[44px] flex items-center text-[13px] sm:text-[12px] font-medium theme-transition",
              selected
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--color-primary-200)] hover:text-[var(--color-primary)]",
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
  const isBlue = color === "blue";
  return (
    <div className={[
      "glass-card-sm px-4 py-3.5 theme-transition",
      isBlue ? "hover:border-[var(--color-primary-200)]" : "hover:border-amber-300",
    ].join(" ")}>
      <div className={`text-[12px] font-medium ${isBlue ? "text-[var(--color-primary)]" : "text-amber-500"}`}>{label}</div>
      <div className="mt-1 text-[22px] font-bold text-[var(--text)] animate-score-pop">
        {value}
        {suffix && <span className="text-[13px] font-normal text-[var(--text-muted)] ml-1">{suffix}</span>}
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
      <div className="glass-card p-4 hover-lift hover:border-[var(--color-primary-200)] theme-transition">
        <div className="flex items-start gap-3">
          {/* Number */}
          <div className="shrink-0 w-7 text-[11px] text-[var(--text-faint)] pt-1 text-right font-mono">#{index}</div>

          {/* Type badge */}
          <div className="shrink-0 rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-2.5 py-1.5 text-[12px] font-bold text-[var(--color-primary)]">W</div>

          <div className="flex-1 min-w-0">
            {/* Prompt */}
            {w.prompt && (
              <p className="line-clamp-2 text-[13px] text-[var(--text)] font-medium leading-snug">{w.prompt}</p>
            )}

            {/* Band scores */}
            <div className="mt-2.5 flex items-center gap-4 flex-wrap">
              {/* Overall */}
              {overall != null && (
                <div className="flex items-baseline gap-1 animate-score-pop">
                  <span className="text-[26px] font-bold text-[var(--text)] leading-none">
                    {overall.toFixed(1).replace(/\.0$/, "")}
                  </span>
                  <span className="text-[12px] text-[var(--text-faint)] font-normal">/9</span>
                </div>
              )}

              {/* Progress bar */}
              {overall != null && (
                <div className="flex-1 min-w-[80px] max-w-[140px]">
                  <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                    <div
                      className="h-full rounded-full animate-progress-fill"
                      style={{ width: `${pct}%`, backgroundColor: "var(--color-primary)" }}
                    />
                  </div>
                </div>
              )}

              {/* Sub-scores */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { k: "Task", v: w.band?.taskResponse },
                  { k: "Coh.", v: w.band?.coherence },
                  { k: "Lex.", v: w.band?.lexical },
                  { k: "Gram.", v: w.band?.grammar },
                ].map(({ k, v }) =>
                  v != null ? (
                    <span
                      key={k}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--text-secondary)]"
                    >
                      {k} <span className="font-bold text-[var(--text)]">{v.toFixed(1).replace(/\.0$/, "")}</span>
                    </span>
                  ) : null,
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
              {when && <span>{when}</span>}
              {w.words && <span className="text-[var(--text-faint)]">{w.words} words</span>}
              {w.durationSec && <span className="text-[var(--text-faint)]">{fmtSec(w.durationSec)}</span>}
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
    <div className="glass-card p-4 hover-lift hover:border-amber-300 theme-transition">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-7 text-[11px] text-[var(--text-faint)] pt-1 text-right font-mono">#{index}</div>
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] font-bold text-amber-700">S</div>

        <div className="flex-1 min-w-0">
          {s.prompt && (
            <p className="line-clamp-2 text-[13px] text-[var(--text)] font-medium leading-snug">{s.prompt}</p>
          )}

          <div className="mt-2.5 flex items-center gap-4 flex-wrap">
            {overall != null && (
              <div className="flex items-baseline gap-1 animate-score-pop">
                <span className="text-[26px] font-bold text-[var(--text)] leading-none">
                  {overall.toFixed(1).replace(/\.0$/, "")}
                </span>
                <span className="text-[12px] text-[var(--text-faint)] font-normal">/9</span>
              </div>
            )}

            {overall != null && (
              <div className="flex-1 min-w-[80px] max-w-[140px]">
                <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full animate-progress-fill"
                    style={{ width: `${pct}%`, backgroundColor: "#f59e0b" }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
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
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--text-secondary)]"
                  >
                    {k} <span className="font-bold text-[var(--text)]">{v.toFixed(1).replace(/\.0$/, "")}</span>
                  </span>
                ) : null,
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
            {when && <span>{when}</span>}
            {s.durationSec && <span className="text-[var(--text-faint)]">{fmtSec(s.durationSec)}</span>}
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
