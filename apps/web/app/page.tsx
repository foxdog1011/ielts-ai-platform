// apps/web/app/page.tsx
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { latestOfType, latestHistory, type HistoryRecord } from "@/lib/history";
import { SparkLine } from "@/components/SparkLine";

export default async function HomePage() {
  noStore();

  const [latestW, latestS, recentHistory] = await Promise.all([
    latestOfType("writing").catch(() => undefined),
    latestOfType("speaking").catch(() => undefined),
    latestHistory(20).catch(() => [] as HistoryRecord[]),
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
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <BackgroundDecor />

      {/* Header */}
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center shadow-sm">
              <span className="text-white text-[11px] font-bold">AI</span>
            </div>
            <h1 className="text-[17px] font-semibold tracking-tight">IELTS AI</h1>
          </div>

          <nav className="flex items-center gap-1.5 text-[12px]">
            {[
              { href: "/history", label: "歷史紀錄" },
              { href: "/prompts", label: "題庫" },
              { href: "/calibration", label: "校準曲線" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero section */}
      <section className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="rounded-3xl border border-zinc-200/80 bg-white/80 p-8 sm:p-12 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-[26px] sm:text-[30px] leading-[1.2] font-semibold tracking-tight">
                Less Distraction. More Expression.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-600 max-w-xl">
                專為 IELTS Writing 與 Speaking 打造的 AI 練習平台，即時評分、雷達分析、進步趨勢一目了然。
              </p>
            </div>

            {/* Stats strip */}
            {totalSessions > 0 && (
              <div className="flex items-center gap-4">
                <StatPill label="練習次數" value={String(totalSessions)} />
                {avgBand && <StatPill label="近期平均" value={`${avgBand} /9`} accent />}
              </div>
            )}
          </div>

          {/* Main action cards */}
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <PrimaryCard
              title="Writing Task 2"
              desc="即時分項評分、雷達圖分析、逐段建議、優化版本"
              href="/tasks/1/writing"
              tone="brand"
              meta={fmtLatest(latestWOverall)}
              metaHref="/history?type=writing"
              trend={writingTrend}
              actions={[
                { label: "開始 Writing", href: "/tasks/1/writing" },
                { label: "抽一題", href: "/tasks/1/writing?q=random", subtle: true },
              ]}
            />

            <PrimaryCard
              title="Speaking (Part 2)"
              desc="兩分鐘限時錄音、轉文字、雷達圖、口語反饋"
              href="/tasks/1/speaking"
              tone="speak"
              meta={fmtLatest(latestSOverall)}
              metaHref="/history?type=speaking"
              trend={speakingTrend}
              actions={[
                { label: "開始 Speaking", href: "/tasks/1/speaking" },
                { label: "抽一題", href: "/tasks/1/speaking?q=random", subtle: true },
              ]}
            />
          </div>

          {/* Recent sessions */}
          {recentHistory.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-zinc-700">最近練習</h3>
                <Link href="/history" className="text-[12px] text-zinc-400 hover:text-zinc-700 transition-colors">
                  查看全部 →
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recentHistory.slice(0, 6).map((rec, i) => (
                  <RecentCard key={i} rec={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Feature pills */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { t: "真考向度評分", d: "依 IELTS 四大構面評分：Task, Coherence, Lexical, Grammar" },
              { t: "雷達圖分析", d: "視覺化各維度強弱，一眼找出最需要改進的方向" },
              { t: "可比對的進步", d: "保存每次結果形成趨勢，聚焦高影響錯誤" },
            ].map((it) => (
              <div key={it.t} className="rounded-xl border border-zinc-200 bg-white/70 p-4 hover:border-zinc-300 transition-colors">
                <div className="text-[13px] font-semibold text-zinc-900">{it.t}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-zinc-500">{it.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 sm:px-8 py-10">
        <p className="text-[12px] text-zinc-400">© {new Date().getFullYear()} IELTS AI · Powered by GPT-4o / o3-mini</p>
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
  if (n == null || Number.isNaN(Number(n))) return "尚未有紀錄";
  const s = Number(n).toFixed(1).replace(/\.0$/, "");
  return `最近：${s} /9`;
}

function fmtDate(rec: HistoryRecord) {
  const ts = (rec as any).ts ?? (rec.createdAt ? Date.parse(rec.createdAt) : null);
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ---------------- components ---------------- */

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${accent ? "border-blue-200 bg-blue-50" : "border-zinc-200 bg-white"}`}>
      <div className={`text-[18px] font-bold ${accent ? "text-blue-700" : "text-zinc-900"}`}>{value}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function RecentCard({ rec }: { rec: HistoryRecord }) {
  const overall = (rec as any).band?.overall ?? (rec as any).band?.content;
  const isWriting = rec.type === "writing";
  const accent = isWriting ? "blue" : "amber";
  const bandColor = isWriting ? "#3b82f6" : "#f59e0b";
  const pct = overall ? Math.min(100, (overall / 9) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 flex items-center gap-3 hover:border-zinc-300 transition-colors">
      <div className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${isWriting ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
        {isWriting ? "W" : "S"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-zinc-900">
            {overall != null ? `Band ${Number(overall).toFixed(1).replace(/\.0$/, "")}` : "—"}
          </span>
          <span className="text-[11px] text-zinc-400">{fmtDate(rec)}</span>
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bandColor }} />
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
        band: "from-blue-500/70 via-sky-400/60 to-blue-500/70",
        dot: "bg-blue-500/20",
        ring: "ring-blue-300/40 hover:ring-blue-400/50",
        sparkColor: "#3b82f6",
        action: "border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100",
      }
    : {
        band: "from-amber-500/70 via-orange-400/60 to-amber-500/70",
        dot: "bg-amber-500/20",
        ring: "ring-amber-300/40 hover:ring-amber-400/50",
        sparkColor: "#f59e0b",
        action: "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
      };

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 p-6 sm:p-7 shadow-sm backdrop-blur",
        "ring-1 ring-inset transition-[transform,box-shadow] duration-200 will-change-transform",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]",
        palette.ring,
      ].join(" ")}
    >
      {/* Decorative stripe */}
      <div
        aria-hidden
        className={["absolute -left-8 top-0 h-full w-24 -skew-x-[14deg] opacity-90 bg-gradient-to-b", palette.band].join(" ")}
      />
      <div className="relative ml-6 sm:ml-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-inset ring-white/60 backdrop-blur bg-white/60">
              <div className={`h-full w-full rounded-xl ${palette.dot}`} />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight">{props.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">{props.desc}</p>
            </div>
          </div>
          <Link href={props.href} className="ml-auto hidden text-zinc-400 hover:text-zinc-700 sm:block" aria-label={`前往 ${props.title}`}>→</Link>
        </div>

        {/* Trend sparkline */}
        {props.trend && props.trend.length >= 2 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">趨勢</span>
            <SparkLine values={props.trend} width={100} height={28} color={palette.sparkColor} />
            <span className="text-[11px] text-zinc-500">
              {props.trend[props.trend.length - 1].toFixed(1).replace(/\.0$/, "")} /9
            </span>
          </div>
        )}

        {/* meta + actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {props.meta && (
            <Link
              href={props.metaHref || "#"}
              className="inline-flex items-center rounded-lg border border-zinc-200 bg-white/70 px-2 py-1 text-[12px] text-zinc-600 hover:border-zinc-300 transition-colors"
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
                  "rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  a.subtle ? "border-zinc-300 bg-white hover:bg-zinc-50" : palette.action,
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

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 40% at 30% -10%, rgba(9,9,11,0.06), transparent 60%), radial-gradient(50% 35% at 80% 0%, rgba(24,24,27,0.05), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(#d4d4d8 1px, transparent 1px), radial-gradient(#e4e4e7 1px, transparent 1px)",
          backgroundSize: "22px 22px, 44px 44px",
          backgroundPosition: "0 0, 11px 11px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-[320px] w-[320px] -z-10 rounded-3xl blur-2xl"
        style={{ background: "radial-gradient(closest-side, rgba(59,130,246,0.16), transparent 75%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-24 h-[300px] w-[300px] -z-10 rounded-3xl blur-2xl"
        style={{ background: "radial-gradient(closest-side, rgba(245,158,11,0.14), transparent 75%)" }}
      />
    </>
  );
}
