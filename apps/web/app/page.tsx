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

  // Gamification data (fetched in parallel, errors silently absorbed)
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

  const latestWOverall =
    typeof latestW?.band === "object" && typeof (latestW as any)?.band?.overall === "number"
      ? (latestW as any).band.overall as number
      : undefined;

  const latestSOverall = pickSpeakingOverall(latestS);

  // Build trend arrays from history
  const writingTrend = recentHistory
    .filter((r) => r.type === "writing")
    .slice(0, 10)
    .reverse()
    .map((r: any) => r.band?.overall)
    .filter((v): v is number => typeof v === "number");

  const speakingTrend = recentHistory
    .filter((r) => r.type === "speaking")
    .slice(0, 10)
    .reverse()
    .map((r: any) => r.band?.overall ?? r.band?.content)
    .filter((v): v is number => typeof v === "number");

  const totalSessions = recentHistory.length;
  const avgBand =
    recentHistory.length > 0
      ? (
          recentHistory
            .map((r: any) => r.band?.overall ?? r.band?.content ?? null)
            .filter((v): v is number => v != null)
            .reduce((a, b) => a + b, 0) /
          Math.max(
            1,
            recentHistory.filter((r: any) => (r.band?.overall ?? r.band?.content) != null).length
          )
        ).toFixed(1)
      : null;

  return (
    <main className="relative min-h-dvh bg-[var(--bg)] text-[var(--text)] font-brand">
      <BackgroundDecor />

      {/* Header */}
      <header className="mx-auto max-w-6xl px-4 sm:px-8 pt-8 pb-5 animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center shadow-md">
              <span className="text-white text-[11px] font-bold tracking-wide">AI</span>
            </div>
            <h1 className="text-[17px] font-semibold tracking-tight">IELTS AI</h1>
          </div>

          <nav className="hidden sm:flex items-center gap-1.5 text-[13px] sm:text-[12px]">
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
            <StreakBadge initialStreak={streakInfo} />
            <ThemeToggle />
          </nav>
          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-2">
            <StreakBadge initialStreak={streakInfo} />
            <ThemeToggle />
            <MobileNav />
          </div>
        </div>
      </header>

      {/* Hero section with gradient */}
      <section className="mx-auto max-w-6xl px-4 sm:px-8 animate-fade-up animate-fade-up-1">
        <div className="hero-gradient rounded-3xl p-8 sm:p-12 shadow-lg relative overflow-hidden">
          {/* Floating decorative orbs */}
          <div aria-hidden className="absolute top-6 right-12 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="absolute bottom-4 left-8 w-24 h-24 rounded-full bg-white/5 blur-xl" />

          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-[26px] sm:text-[32px] leading-[1.2] font-bold tracking-tight text-white">
                Less Distraction. More Expression.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/80 max-w-xl">
                AI-powered IELTS Writing &amp; Speaking platform with instant scoring, radar analysis, and progress tracking.
              </p>
            </div>

            {/* Stats strip */}
            {totalSessions > 0 && (
              <div className="flex items-center gap-3">
                <HeroStat label="Sessions" value={String(totalSessions)} />
                {avgBand && <HeroStat label="Avg Band" value={`${avgBand}`} accent />}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="mx-auto max-w-6xl px-4 sm:px-8 -mt-6 relative z-10">
        <div className="glass-card p-8 sm:p-10 animate-fade-up animate-fade-up-2">

          {/* Gamification strip: XP bar + Daily challenge */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <XPBar initialXP={xpInfo} />
            <DailyChallengeCard challenge={dailyChallenge} />
          </div>

          {/* Main action cards */}
          <div className="grid gap-5 sm:grid-cols-2">
            <PrimaryCard
              title="Writing Task 2"
              desc="Instant sub-score grading, radar chart analysis, paragraph-level feedback"
              href="/tasks/1/writing"
              tone="brand"
              meta={fmtLatest(latestWOverall)}
              metaHref="/history?type=writing"
              trend={writingTrend}
              actions={[
                { label: "Start Writing", href: "/tasks/1/writing" },
                { label: "Random", href: "/tasks/1/writing?q=random", subtle: true },
              ]}
            />

            <PrimaryCard
              title="Speaking Part 2"
              desc="2-minute timed recording, speech-to-text, radar chart, spoken feedback"
              href="/tasks/1/speaking"
              tone="speak"
              meta={fmtLatest(latestSOverall)}
              metaHref="/history?type=speaking"
              trend={speakingTrend}
              actions={[
                { label: "Start Speaking", href: "/tasks/1/speaking" },
                { label: "Random", href: "/tasks/1/speaking?q=random", subtle: true },
              ]}
            />
          </div>

          {/* Recent sessions */}
          {recentHistory.length > 0 && (
            <div className="mt-10 animate-fade-up animate-fade-up-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-[var(--text)]">Recent Sessions</h3>
                <Link href="/history" className="text-[12px] text-[var(--text-muted)] hover:text-[var(--color-primary)] theme-transition">
                  View all &rarr;
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentHistory.slice(0, 6).map((rec, i) => (
                  <RecentCard key={i} rec={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Learning calendar */}
          {allHistory.length > 0 && (
            <div className="mt-8 animate-fade-up animate-fade-up-4">
              <LearningCalendar history={allHistory} />
            </div>
          )}

          {/* Weekly summary */}
          {(weeklySummary.writing != null || weeklySummary.speaking != null) && (
            <div className="mt-10 animate-fade-up animate-fade-up-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-[var(--text)]">This Week</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {weeklySummary.writing != null && <WeeklySummaryCard summary={weeklySummary.writing} />}
                {weeklySummary.speaking != null && <WeeklySummaryCard summary={weeklySummary.speaking} />}
              </div>
            </div>
          )}

          {/* Feature pills */}
          <div className="mt-10 grid gap-4 grid-cols-1 sm:grid-cols-3 animate-fade-up animate-fade-up-5">
            {[
              { icon: "🎯", t: "IELTS-Aligned Scoring", d: "Graded across 4 dimensions: Task, Coherence, Lexical, Grammar" },
              { icon: "📊", t: "Radar Analysis", d: "Visualize strengths and weaknesses at a glance for targeted improvement" },
              { icon: "📈", t: "Track Progress", d: "Every session saved as a trend point. Focus on high-impact errors" },
            ].map((it) => (
              <div
                key={it.t}
                className="glass-card-sm p-5 hover-lift theme-transition group"
              >
                <div className="text-[24px] mb-2 group-hover:animate-score-pop">{it.icon}</div>
                <div className="text-[13px] font-semibold text-[var(--text)]">{it.t}</div>
                <div className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">{it.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 sm:px-8 py-10">
        <p className="text-[12px] text-[var(--text-faint)]">&copy; {new Date().getFullYear()} IELTS AI &middot; Powered by GPT-4o / o3-mini</p>
      </footer>
    </main>
  );
}

/* ---------------- helpers ---------------- */

function pickSpeakingOverall(rec?: HistoryRecord): number | undefined {
  if (!rec || rec.type !== "speaking" || !rec.band) return undefined;
  const b: any = rec.band;
  if (typeof b.overall === "number") return b.overall as number;
  if (typeof b.content === "number") return b.content as number;
  return undefined;
}

function fmtLatest(n?: number) {
  if (n == null || Number.isNaN(Number(n))) return "No records yet";
  const s = Number(n).toFixed(1).replace(/\.0$/, "");
  return `Latest: ${s} /9`;
}

function fmtDate(rec: HistoryRecord) {
  const ts = (rec as any).ts ?? (rec.createdAt ? Date.parse(rec.createdAt) : null);
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ---------------- components ---------------- */

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={[
      "rounded-xl px-4 py-2.5 text-center backdrop-blur-sm",
      accent
        ? "bg-white/20 border border-white/30"
        : "bg-white/10 border border-white/20",
    ].join(" ")}>
      <div className="text-[20px] font-bold text-white">{value}</div>
      <div className="text-[11px] text-white/70 mt-0.5">{label}</div>
    </div>
  );
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={[
      "rounded-xl border px-3 py-2 text-center theme-transition",
      accent
        ? "border-[var(--color-primary-200)] bg-[var(--color-primary-50)]"
        : "border-[var(--border)] bg-[var(--surface)]",
    ].join(" ")}>
      <div className={`text-[18px] font-bold ${accent ? "text-[var(--color-primary)]" : "text-[var(--text)]"}`}>{value}</div>
      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{label}</div>
    </div>
  );
}

function RecentCard({ rec }: { rec: HistoryRecord }) {
  const overall = (rec as any).band?.overall ?? (rec as any).band?.content;
  const isWriting = rec.type === "writing";
  const pct = overall ? Math.min(100, (overall / 9) * 100) : 0;

  return (
    <div className="glass-card-sm px-4 py-3 flex items-center gap-3 hover-lift theme-transition">
      <div className={[
        "shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold border",
        isWriting
          ? "bg-[var(--color-primary-50)] text-[var(--color-primary)] border-[var(--color-primary-200)]"
          : "bg-amber-50 text-amber-700 border-amber-200",
      ].join(" ")}>
        {isWriting ? "W" : "S"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--text)]">
            {overall != null ? `Band ${Number(overall).toFixed(1).replace(/\.0$/, "")}` : "\u2014"}
          </span>
          <span className="text-[11px] text-[var(--text-faint)]">{fmtDate(rec)}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden">
          <div
            className="h-full rounded-full animate-progress-fill"
            style={{
              width: `${pct}%`,
              backgroundColor: isWriting ? "var(--color-primary)" : "#f59e0b",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PrimaryCard(props: {
  title: string;
  desc: string;
  href: string;
  tone: "brand" | "speak";
  meta?: string;
  metaHref?: string;
  trend?: number[];
  actions?: Array<{ label: string; href: string; subtle?: boolean }>;
}) {
  const isBlue = props.tone === "brand";
  const palette = isBlue
    ? {
        band: "from-[var(--color-primary)]/60 via-[var(--color-primary-light)]/50 to-[var(--color-primary)]/60",
        dot: "bg-[var(--color-primary)]/20",
        ring: "ring-[var(--color-primary-200)] hover:ring-[var(--color-primary)]/40",
        sparkColor: "var(--color-primary)",
        action: "border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]",
      }
    : {
        band: "from-amber-500/60 via-orange-400/50 to-amber-500/60",
        dot: "bg-amber-500/20",
        ring: "ring-amber-300/40 hover:ring-amber-400/50",
        sparkColor: "#f59e0b",
        action: "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
      };

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-6 sm:p-7 shadow-sm backdrop-blur",
        "ring-1 ring-inset hover-lift theme-transition",
        palette.ring,
      ].join(" ")}
    >
      {/* Decorative stripe */}
      <div
        aria-hidden
        className={["absolute -left-8 top-0 h-full w-24 -skew-x-[14deg] opacity-80 bg-gradient-to-b", palette.band].join(" ")}
      />
      <div className="relative ml-6 sm:ml-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-inset ring-white/60 backdrop-blur bg-[var(--surface-overlay)]">
              <div className={`h-full w-full rounded-xl ${palette.dot}`} />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-[var(--text)]">{props.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{props.desc}</p>
            </div>
          </div>
          <Link href={props.href} className="ml-auto hidden text-[var(--text-faint)] hover:text-[var(--color-primary)] sm:block theme-transition" aria-label={`Go to ${props.title}`}>&rarr;</Link>
        </div>

        {/* Trend sparkline */}
        {props.trend && props.trend.length >= 2 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-faint)]">Trend</span>
            <SparkLine values={props.trend} width={100} height={28} color={palette.sparkColor} />
            <span className="text-[11px] text-[var(--text-muted)]">
              {props.trend[props.trend.length - 1].toFixed(1).replace(/\.0$/, "")} /9
            </span>
          </div>
        )}

        {/* meta + actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {props.meta && (
            <Link
              href={props.metaHref || "#"}
              className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--color-primary-200)] theme-transition"
            >
              {props.meta}
            </Link>
          )}
          <div className="ml-auto flex items-center gap-2">
            {(props.actions || []).map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className={[
                  "rounded-xl border px-3.5 py-2 text-[12px] font-medium theme-transition",
                  a.subtle
                    ? "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--color-primary-200)]"
                    : palette.action,
                ].join(" ")}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklySummaryCard({ summary }: { summary: ExamTypeSummary }) {
  const isWriting = summary.examType === "writing";
  const trendIcon: Record<string, string> = {
    improving: "\u2191",
    stable: "\u2192",
    declining: "\u2193",
    first_session: "\u2605",
    insufficient_data: "\u2014",
  };
  const trendColor: Record<string, string> = {
    improving: "text-[var(--color-success)]",
    stable: "text-[var(--text-muted)]",
    declining: "text-[var(--color-error)]",
    first_session: "text-[var(--color-primary)]",
    insufficient_data: "text-[var(--text-faint)]",
  };
  const urgencyBadge: Record<string, string> = {
    urgent: "bg-[var(--color-error-light)] text-[var(--color-error)] border-[var(--color-error)]/20",
    normal: "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]",
    maintenance: "bg-[var(--color-success-light)] text-[var(--color-success-dark)] border-[var(--color-success)]/20",
  };
  const urgencyLabel: Record<string, string> = {
    urgent: "Needs Work",
    normal: "Steady",
    maintenance: "On Track",
  };

  return (
    <div className={[
      "glass-card-sm p-5 theme-transition",
      isWriting ? "hover:border-[var(--color-primary-200)]" : "hover:border-amber-300",
    ].join(" ")}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[13px] font-semibold ${isWriting ? "text-[var(--color-primary)]" : "text-amber-500"}`}>
          {isWriting ? "Writing" : "Speaking"}
        </span>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${urgencyBadge[summary.urgency]}`}>
          {urgencyLabel[summary.urgency]}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        {summary.latestBand != null ? (
          <>
            <span className="text-[24px] font-bold text-[var(--text)] animate-score-pop">
              {summary.latestBand.toFixed(1).replace(/\.0$/, "")}
            </span>
            <span className="text-[11px] text-[var(--text-faint)]">/9</span>
          </>
        ) : (
          <span className="text-[14px] text-[var(--text-muted)]">No records yet</span>
        )}
        {summary.trend !== "insufficient_data" && (
          <span className={`text-[14px] font-semibold ${trendColor[summary.trend]}`}>
            {trendIcon[summary.trend]}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
        <span>This week: {summary.sessionCount}</span>
        {summary.avgBand != null && <span>Avg: {summary.avgBand}</span>}
        {summary.bandDelta != null && summary.bandDelta !== 0 && (
          <span className={summary.bandDelta > 0 ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}>
            {summary.bandDelta > 0 ? "+" : ""}{summary.bandDelta}
          </span>
        )}
      </div>
      {summary.persistentWeaknesses.length > 0 && (
        <div className="mt-2 text-[11px] text-[var(--text-muted)]">
          Focus: {summary.persistentWeaknesses.slice(0, 2).join(", ")}
        </div>
      )}
    </div>
  );
}

function BackgroundDecor() {
  return (
    <>
      {/* Soft radial gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 40% at 30% -10%, rgba(74,144,217,0.08), transparent 60%), radial-gradient(50% 35% at 80% 0%, rgba(74,144,217,0.05), transparent 65%)",
        }}
      />
      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(var(--text-faint) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
        }}
      />
      {/* Blue orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-[320px] w-[320px] -z-10 rounded-3xl blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(74,144,217,0.15), transparent 75%)" }}
      />
      {/* Warm orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-24 h-[300px] w-[300px] -z-10 rounded-3xl blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(255,184,0,0.1), transparent 75%)" }}
      />
    </>
  );
}
