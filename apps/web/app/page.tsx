// apps/web/app/page.tsx
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { latestOfType, latestHistory, listHistory, type HistoryRecord } from "@/lib/history";
import { SparkLine } from "@/components/SparkLine";
import { buildWeeklySummaryPayload, type ExamTypeSummary } from "@/lib/weeklySummary";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LearningCalendar } from "@/components/LearningCalendar";
import { MobileNav } from "@/components/MobileNav";
import { getStreak } from "@/features/gamification/streak-service";
import { getXP } from "@/features/gamification/xp-service";
import { getDailyChallenge } from "@/features/gamification/daily-challenge";
import { getUserId } from "@/features/gamification/get-user-id";
import { StreakBadge } from "@/features/gamification/components/StreakBadge";
import { XPBar } from "@/features/gamification/components/XPBar";
import { DailyChallenge as DailyChallengeCard } from "@/features/gamification/components/DailyChallenge";

export default async function HomePage() {
  noStore();

  const [latestW, latestS, recentHistory, writingHistory, speakingHistory, allHistory] = await Promise.all([
    latestOfType("writing").catch(() => undefined),
    latestOfType("speaking").catch(() => undefined),
    latestHistory(20).catch(() => [] as HistoryRecord[]),
    listHistory({ type: "writing", limit: 50 }).catch(() => [] as HistoryRecord[]),
    listHistory({ type: "speaking", limit: 50 }).catch(() => [] as HistoryRecord[]),
    listHistory({ limit: 200 }).catch(() => [] as HistoryRecord[]),
  ]);

  const weeklySummary = buildWeeklySummaryPayload({ writingHistory, speakingHistory });

  const userId = await getUserId().catch(() => "anonymous");
  const [streakInfo, xpInfo, dailyChallenge] = await Promise.all([
    getStreak(userId).catch(() => ({ currentStreak: 0, longestStreak: 0, lastPracticeDate: "", streakFreezes: 0 })),
    getXP(userId).catch(() => ({ totalXP: 0, level: 0, xpToNextLevel: 100 })),
    getDailyChallenge(userId).catch(() => ({
      date: new Date().toISOString().slice(0, 10),
      prompt: "Some people believe that universities should focus on providing academic skills. Discuss both views.",
      type: "writing" as const,
      completed: false,
    })),
  ]);

  const latestWOverall = pickOverall(latestW, "writing");
  const latestSOverall = pickOverall(latestS, "speaking");

  const writingTrend = buildTrend(recentHistory, "writing");
  const speakingTrend = buildTrend(recentHistory, "speaking");

  return (
    <main className="relative min-h-dvh bg-[var(--bg)] text-[var(--text)] font-brand">
      {/* Subtle background gradient -- no heavy orbs */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 40% at 30% -10%, rgba(74,144,217,0.06), transparent 60%)",
        }}
      />

      {/* ---- Header ---- */}
      <header className="mx-auto max-w-5xl px-4 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center shadow-md">
              <span className="text-white text-[11px] font-bold tracking-wide">AI</span>
            </div>
            <h1 className="text-[17px] font-semibold tracking-tight">IELTS AI</h1>
          </div>

          <nav className="hidden sm:flex items-center gap-1.5 text-[12px]">
            {[
              { href: "/history", label: "History" },
              { href: "/prompts", label: "Prompts" },
              { href: "/goals", label: "Goals" },
              { href: "/notebook", label: "Notebook" },
              { href: "/calibration", label: "Calibration" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 min-h-[44px] flex items-center hover:border-[var(--color-primary-200)] hover:text-[var(--color-primary)] theme-transition"
              >
                {label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <MobileNav />
          </div>
        </div>
      </header>

      {/* ---- Progress strip (Streak + XP + Daily Challenge) ---- */}
      <section className="mx-auto max-w-5xl px-4 sm:px-8 mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StreakBadge initialStreak={streakInfo} />
          <XPBar initialXP={xpInfo} />
          <DailyChallengeCard challenge={dailyChallenge} />
        </div>
      </section>

      {/* ---- Main action cards ---- */}
      <section className="mx-auto max-w-5xl px-4 sm:px-8 mb-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <ActionCard
            title="Writing Task 2"
            desc="Sub-score grading, radar chart, paragraph-level feedback"
            tone="brand"
            latestBand={latestWOverall}
            trend={writingTrend}
            actions={[
              { label: "Start Writing", href: "/tasks/1/writing", primary: true },
              { label: "Random", href: "/tasks/1/writing?q=random" },
            ]}
            historyHref="/history?type=writing"
          />
          <ActionCard
            title="Speaking Part 2"
            desc="Timed recording, speech-to-text, radar chart, spoken feedback"
            tone="speak"
            latestBand={latestSOverall}
            trend={speakingTrend}
            actions={[
              { label: "Start Speaking", href: "/tasks/1/speaking", primary: true },
              { label: "Random", href: "/tasks/1/speaking?q=random" },
            ]}
            historyHref="/history?type=speaking"
          />
        </div>
      </section>

      {/* ---- Collapsible sections ---- */}
      <section className="mx-auto max-w-5xl px-4 sm:px-8 space-y-4 pb-12">

        {/* Learning Progress */}
        {allHistory.length > 0 && (
          <details open className="group glass-card overflow-hidden">
            <CollapsibleSummary label="Learning Progress" />
            <div className="px-6 pb-6 space-y-6">
              <LearningCalendar history={allHistory} />
              {(weeklySummary.writing != null || weeklySummary.speaking != null) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {weeklySummary.writing != null && <WeeklySummaryCard summary={weeklySummary.writing} />}
                  {weeklySummary.speaking != null && <WeeklySummaryCard summary={weeklySummary.speaking} />}
                </div>
              )}
            </div>
          </details>
        )}

        {/* Recent Sessions */}
        {recentHistory.length > 0 && (
          <details open className="group glass-card overflow-hidden">
            <CollapsibleSummary label="Recent Sessions" trailingHref="/history" trailingLabel="View all" />
            <div className="px-6 pb-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentHistory.slice(0, 6).map((rec, i) => (
                  <RecentCard key={i} rec={rec} />
                ))}
              </div>
            </div>
          </details>
        )}

        {/* Features */}
        <details className="group glass-card overflow-hidden">
          <CollapsibleSummary label="Features" />
          <div className="px-6 pb-6 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🎯", t: "IELTS-Aligned Scoring", d: "Graded across 4 dimensions: Task, Coherence, Lexical, Grammar" },
              { icon: "📊", t: "Radar Analysis", d: "Visualize strengths and weaknesses at a glance" },
              { icon: "📈", t: "Track Progress", d: "Every session saved as a trend point for targeted improvement" },
            ].map((it) => (
              <div key={it.t} className="glass-card-sm p-5 theme-transition">
                <div className="text-[22px] mb-2">{it.icon}</div>
                <div className="text-[13px] font-semibold text-[var(--text)]">{it.t}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">{it.d}</div>
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-4 sm:px-8 py-8">
        <p className="text-[12px] text-[var(--text-faint)]">&copy; {new Date().getFullYear()} IELTS AI &middot; Powered by GPT-4o / o3-mini</p>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function pickOverall(rec: HistoryRecord | undefined, type: string): number | undefined {
  if (!rec || rec.type !== type || !rec.band) return undefined;
  const b: Record<string, unknown> = rec.band as Record<string, unknown>;
  if (typeof b.overall === "number") return b.overall;
  if (typeof b.content === "number") return b.content;
  return undefined;
}

function buildTrend(history: HistoryRecord[], type: string): number[] {
  return history
    .filter((r) => r.type === type)
    .slice(0, 10)
    .reverse()
    .map((r: Record<string, unknown>) => {
      const b = (r as Record<string, unknown>).band as Record<string, unknown> | undefined;
      return (b?.overall ?? b?.content) as number | undefined;
    })
    .filter((v): v is number => typeof v === "number");
}

function fmtDate(rec: HistoryRecord): string {
  const ts = (rec as Record<string, unknown>).ts ?? (rec.createdAt ? Date.parse(rec.createdAt) : null);
  if (!ts) return "";
  const d = new Date(ts as number);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function CollapsibleSummary({
  label,
  trailingHref,
  trailingLabel,
}: {
  label: string;
  trailingHref?: string;
  trailingLabel?: string;
}) {
  return (
    <summary className="flex items-center justify-between cursor-pointer px-6 py-4 select-none list-none [&::-webkit-details-marker]:hidden">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-[var(--text)]">{label}</span>
        <span className="text-[12px] text-[var(--text-faint)] transition-transform group-open:rotate-90">&#9654;</span>
      </div>
      {trailingHref && (
        <Link href={trailingHref} className="text-[12px] text-[var(--text-muted)] hover:text-[var(--color-primary)] theme-transition">
          {trailingLabel} &rarr;
        </Link>
      )}
    </summary>
  );
}

function ActionCard(props: {
  title: string; desc: string; tone: "brand" | "speak";
  latestBand?: number; trend?: number[];
  actions: Array<{ label: string; href: string; primary?: boolean }>; historyHref: string;
}) {
  const isBlue = props.tone === "brand";
  const color = isBlue ? "var(--color-primary)" : "#f59e0b";
  const primaryBtn = isBlue
    ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] border-[var(--color-primary-200)]"
    : "bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300";
  const bandStr = props.latestBand != null ? `Latest: ${props.latestBand.toFixed(1).replace(/\.0$/, "")} /9` : "No records yet";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-6 shadow-sm theme-transition">
      <h3 className="text-[17px] font-semibold tracking-tight text-[var(--text)]">{props.title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{props.desc}</p>
      {props.trend && props.trend.length >= 2 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-faint)]">Trend</span>
          <SparkLine values={props.trend} width={100} height={28} color={color} />
          <span className="text-[11px] text-[var(--text-muted)]">{props.trend[props.trend.length - 1].toFixed(1).replace(/\.0$/, "")} /9</span>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={props.historyHref} className="rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--color-primary-200)] theme-transition">{bandStr}</Link>
        <div className="ml-auto flex items-center gap-2">
          {props.actions.map((a) => (
            <Link key={a.href + a.label} href={a.href} className={["rounded-xl border px-4 py-2.5 text-[13px] font-medium theme-transition min-h-[44px] flex items-center", a.primary ? primaryBtn : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)]"].join(" ")}>{a.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecentCard({ rec }: { rec: HistoryRecord }) {
  const b = (rec as Record<string, unknown>).band as Record<string, number> | undefined;
  const overall = b?.overall ?? b?.content;
  const isW = rec.type === "writing";
  const pct = overall ? Math.min(100, (overall / 9) * 100) : 0;
  const color = isW ? "var(--color-primary)" : "#f59e0b";
  const badge = isW
    ? "bg-[var(--color-primary-50)] text-[var(--color-primary)] border-[var(--color-primary-200)]"
    : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="glass-card-sm px-4 py-3 flex items-center gap-3 theme-transition">
      <div className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold border ${badge}`}>{isW ? "W" : "S"}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--text)]">
            {overall != null ? `Band ${overall.toFixed(1).replace(/\.0$/, "")}` : "\u2014"}
          </span>
          <span className="text-[11px] text-[var(--text-faint)]">{fmtDate(rec)}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

function WeeklySummaryCard({ summary }: { summary: ExamTypeSummary }) {
  const isW = summary.examType === "writing";
  const icons: Record<string, string> = { improving: "\u2191", stable: "\u2192", declining: "\u2193", first_session: "\u2605", insufficient_data: "\u2014" };
  const colors: Record<string, string> = { improving: "text-[var(--color-success)]", stable: "text-[var(--text-muted)]", declining: "text-[var(--color-error)]", first_session: "text-[var(--color-primary)]", insufficient_data: "text-[var(--text-faint)]" };

  return (
    <div className={`glass-card-sm p-5 theme-transition ${isW ? "hover:border-[var(--color-primary-200)]" : "hover:border-amber-300"}`}>
      <span className={`text-[13px] font-semibold mb-2 block ${isW ? "text-[var(--color-primary)]" : "text-amber-500"}`}>
        {isW ? "Writing" : "Speaking"}
      </span>
      <div className="flex items-baseline gap-2">
        {summary.latestBand != null
          ? <><span className="text-[22px] font-bold text-[var(--text)]">{summary.latestBand.toFixed(1).replace(/\.0$/, "")}</span><span className="text-[11px] text-[var(--text-faint)]">/9</span></>
          : <span className="text-[14px] text-[var(--text-muted)]">No records yet</span>}
        {summary.trend !== "insufficient_data" && <span className={`text-[14px] font-semibold ${colors[summary.trend]}`}>{icons[summary.trend]}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
        <span>This week: {summary.sessionCount}</span>
        {summary.avgBand != null && <span>Avg: {summary.avgBand}</span>}
        {summary.bandDelta != null && summary.bandDelta !== 0 && (
          <span className={summary.bandDelta > 0 ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}>{summary.bandDelta > 0 ? "+" : ""}{summary.bandDelta}</span>
        )}
        {summary.persistentWeaknesses.length > 0 && <span>Focus: {summary.persistentWeaknesses.slice(0, 2).join(", ")}</span>}
      </div>
    </div>
  );
}
