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
    <main className="relative min-h-dvh bg-[#F7F7F7] dark:bg-[var(--bg)] text-gray-800 dark:text-[var(--text)] font-brand theme-transition">
      {/* ---- Header ---- */}
      <header className="mx-auto max-w-5xl px-4 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#58CC02] flex items-center justify-center shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]">
              <span className="text-white text-[13px] font-bold tracking-wide">AI</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight dark:text-[var(--text)]">IELTS AI</h1>
          </div>

          <nav className="hidden sm:flex items-center gap-2 text-[13px]">
            {[
              { href: "/history", label: "歷史紀錄", icon: "📋" },
              { href: "/prompts", label: "題庫", icon: "📝" },
              { href: "/goals", label: "練習目標", icon: "🎯" },
              { href: "/notebook", label: "錯題本", icon: "📓" },
              { href: "/mock-exam", label: "模擬考", icon: "📝" },
              { href: "/calibration", label: "校準曲線", icon: "📊" },
              { href: "/leaderboard", label: "排行榜", icon: "🏆" },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] dark:text-[var(--text)] px-3.5 py-2.5 min-h-[44px] flex items-center gap-1.5 font-bold hover:border-[#58CC02] hover:text-[#58CC02] transition-all shadow-[2px_2px_0_0_rgba(0,0,0,0.05)] dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.2)] hover:shadow-[2px_2px_0_0_rgba(88,204,2,0.2)]"
              >
                <span>{icon}</span>
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
            title="寫作 Task 2"
            desc="四維評分、雷達圖分析、段落級回饋"
            tone="brand"
            latestBand={latestWOverall}
            trend={writingTrend}
            actions={[
              { label: "開始寫作 ✍️", href: "/tasks/1/writing", primary: true },
              { label: "隨機題目", href: "/tasks/1/writing?q=random" },
            ]}
            historyHref="/history?type=writing"
          />
          <ActionCard
            title="口說 Part 2"
            desc="計時錄音、語音轉文字、雷達圖分析、語音回饋"
            tone="speak"
            latestBand={latestSOverall}
            trend={speakingTrend}
            actions={[
              { label: "開始口說 🎙️", href: "/tasks/1/speaking", primary: true },
              { label: "隨機題目", href: "/tasks/1/speaking?q=random" },
            ]}
            historyHref="/history?type=speaking"
          />
        </div>
      </section>

      {/* ---- Collapsible sections ---- */}
      <section className="mx-auto max-w-5xl px-4 sm:px-8 space-y-4 pb-12">

        {/* Learning Progress */}
        {allHistory.length > 0 && (
          <details open className="group rounded-2xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] overflow-hidden theme-transition">
            <CollapsibleSummary label="📈 學習進度" />
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
          <details open className="group rounded-2xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] overflow-hidden theme-transition">
            <CollapsibleSummary label="🕐 最近練習" trailingHref="/history" trailingLabel="查看全部" />
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
        <details className="group rounded-2xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] overflow-hidden theme-transition">
          <CollapsibleSummary label="✨ 功能特色" />
          <div className="px-6 pb-6 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🎯", t: "IELTS 對標評分", d: "涵蓋四大維度：任務回應、連貫性、詞彙資源、文法範圍" },
              { icon: "📊", t: "雷達圖分析", d: "一目了然地視覺化你的強項與弱點" },
              { icon: "📈", t: "追蹤進步", d: "每次練習都會儲存為趨勢數據，幫助針對性提升" },
            ].map((it) => (
              <div key={it.t} className="rounded-2xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)] dark:shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] hover:border-[#58CC02]/50 transition-all theme-transition">
                <div className="text-2xl mb-2">{it.icon}</div>
                <div className="text-[14px] font-bold text-gray-800 dark:text-[var(--text)]">{it.t}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-[var(--text-secondary)]">{it.d}</div>
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-4 sm:px-8 py-8">
        <p className="text-[13px] font-bold text-gray-400 dark:text-[var(--text-muted)]">&copy; {new Date().getFullYear()} IELTS AI &middot; Powered by GPT-4o / o3-mini</p>
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
    <summary className="flex items-center justify-between cursor-pointer px-6 py-4 select-none list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 dark:hover:bg-[var(--surface-raised)] transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-bold text-gray-800 dark:text-[var(--text)]">{label}</span>
        <span className="text-[13px] text-gray-400 dark:text-[var(--text-muted)] transition-transform group-open:rotate-90">&#9654;</span>
      </div>
      {trailingHref && (
        <Link href={trailingHref} className="rounded-xl bg-[#58CC02]/10 px-3 py-1.5 text-[12px] font-bold text-[#58CC02] hover:bg-[#58CC02]/20 transition-all">
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
  const color = isBlue ? "#1CB0F6" : "#FFD900";
  const borderColor = isBlue ? "border-[#1CB0F6]/40" : "border-[#FFD900]/60";
  const accentBg = isBlue ? "bg-[#1CB0F6]/10" : "bg-[#FFD900]/10";
  const primaryBtn = isBlue
    ? "bg-[#1CB0F6] text-white hover:bg-[#1899D6] border-[#1CB0F6] shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]"
    : "bg-[#FFD900] text-gray-900 hover:bg-[#E6C400] border-[#FFD900] shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]";
  const bandStr = props.latestBand != null ? `最新: ${props.latestBand.toFixed(1).replace(/\.0$/, "")} /9` : "尚無紀錄";

  return (
    <div className={`rounded-2xl border-2 ${borderColor} bg-white dark:bg-[var(--surface)] p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] transition-all hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.12)] dark:hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.4)] theme-transition`}>
      <div className={`inline-block rounded-xl ${accentBg} px-3 py-1 mb-3`}>
        <h3 className="text-[17px] font-bold tracking-tight text-gray-800 dark:text-[var(--text)]">{props.title}</h3>
      </div>
      <p className="text-[13px] leading-relaxed text-gray-500 dark:text-[var(--text-secondary)] font-medium">{props.desc}</p>
      {props.trend && props.trend.length >= 2 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-[rgba(30,41,59,0.6)] px-3 py-2">
          <span className="text-[12px] font-bold text-gray-400 dark:text-[var(--text-muted)]">趨勢</span>
          <SparkLine values={props.trend} width={100} height={28} color={color} />
          <span className="text-[12px] font-bold text-gray-600 dark:text-[var(--text-secondary)]">{props.trend[props.trend.length - 1].toFixed(1).replace(/\.0$/, "")} /9</span>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={props.historyHref} className="rounded-xl border-2 border-gray-200 dark:border-[var(--border)] bg-gray-50 dark:bg-[rgba(30,41,59,0.6)] px-3 py-1.5 text-[12px] font-bold text-gray-500 dark:text-[var(--text-muted)] hover:border-[#58CC02] hover:text-[#58CC02] transition-all">{bandStr}</Link>
        <div className="ml-auto flex items-center gap-2">
          {props.actions.map((a) => (
            <Link key={a.href + a.label} href={a.href} className={["rounded-xl border-2 px-4 py-2.5 text-[13px] font-bold transition-all min-h-[44px] flex items-center active:scale-[0.97]", a.primary ? primaryBtn : "border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] dark:text-[var(--text)] hover:bg-gray-50 dark:hover:bg-[var(--surface-raised)] hover:border-gray-300 shadow-[2px_2px_0_0_rgba(0,0,0,0.07)] dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"].join(" ")}>{a.label}</Link>
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
  const color = isW ? "#1CB0F6" : "#FFD900";
  const badge = isW
    ? "bg-[#1CB0F6]/15 text-[#1CB0F6] border-[#1CB0F6]/30"
    : "bg-[#FFD900]/20 text-[#B8960F] border-[#FFD900]/40";

  return (
    <div className="rounded-2xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] px-4 py-3 flex items-center gap-3 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)] dark:shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] transition-all theme-transition">
      <div className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold border-2 ${badge}`}>{isW ? "寫" : "說"}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-gray-800 dark:text-[var(--text)]">
            {overall != null ? `${overall.toFixed(1).replace(/\.0$/, "")} 分` : "\u2014"}
          </span>
          <span className="text-[12px] font-bold text-gray-400 dark:text-[var(--text-muted)]">{fmtDate(rec)}</span>
        </div>
        <div className="mt-2 h-3 w-full rounded-full bg-gray-100 dark:bg-[rgba(30,41,59,0.6)] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

function WeeklySummaryCard({ summary }: { summary: ExamTypeSummary }) {
  const isW = summary.examType === "writing";
  const icons: Record<string, string> = { improving: "\u2191", stable: "\u2192", declining: "\u2193", first_session: "\u2605", insufficient_data: "\u2014" };
  const colors: Record<string, string> = { improving: "text-[#58CC02]", stable: "text-gray-500", declining: "text-[#FF4B4B]", first_session: "text-[#1CB0F6]", insufficient_data: "text-gray-400" };

  return (
    <div className={`rounded-2xl border-2 p-5 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)] dark:shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] transition-all theme-transition ${isW ? "border-[#1CB0F6]/30 hover:border-[#1CB0F6]/60 bg-white dark:bg-[var(--surface)]" : "border-[#FFD900]/40 hover:border-[#FFD900]/70 bg-white dark:bg-[var(--surface)]"}`}>
      <span className={`text-[14px] font-bold mb-2 block ${isW ? "text-[#1CB0F6]" : "text-[#B8960F]"}`}>
        {isW ? "✍️ 寫作" : "🎙️ 口說"}
      </span>
      <div className="flex items-baseline gap-2">
        {summary.latestBand != null
          ? <><span className="text-3xl font-bold text-gray-800 dark:text-[var(--text)]">{summary.latestBand.toFixed(1).replace(/\.0$/, "")}</span><span className="text-[12px] font-bold text-gray-400 dark:text-[var(--text-muted)]">/9</span></>
          : <span className="text-[14px] font-bold text-gray-400 dark:text-[var(--text-muted)]">尚無紀錄</span>}
        {summary.trend !== "insufficient_data" && <span className={`text-[16px] font-bold ${colors[summary.trend]}`}>{icons[summary.trend]}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] font-bold text-gray-400 dark:text-[var(--text-muted)]">
        <span className="rounded-xl bg-gray-100 dark:bg-[rgba(30,41,59,0.6)] px-2 py-1">本週: {summary.sessionCount} 次</span>
        {summary.avgBand != null && <span className="rounded-xl bg-gray-100 dark:bg-[rgba(30,41,59,0.6)] px-2 py-1">平均: {summary.avgBand}</span>}
        {summary.bandDelta != null && summary.bandDelta !== 0 && (
          <span className={`rounded-xl px-2 py-1 ${summary.bandDelta > 0 ? "bg-[#58CC02]/10 text-[#58CC02]" : "bg-[#FF4B4B]/10 text-[#FF4B4B]"}`}>{summary.bandDelta > 0 ? "+" : ""}{summary.bandDelta}</span>
        )}
        {summary.persistentWeaknesses.length > 0 && <span className="rounded-xl bg-[#FF4B4B]/10 px-2 py-1 text-[#FF4B4B]">重點: {summary.persistentWeaknesses.slice(0, 2).join(", ")}</span>}
      </div>
    </div>
  );
}
