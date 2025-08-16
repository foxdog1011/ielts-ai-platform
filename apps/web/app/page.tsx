// apps/web/app/page.tsx
import Link from "next/link";
import QuickStart from "./QuickStart";
import { listHistory } from "@/lib/history";

export default async function HomePage() {
  const [latestW] = await listHistory({ type: "writing", limit: 1 });
  const [latestS] = await listHistory({ type: "speaking", limit: 1 });

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <BackgroundDecor />

      {/* Header */}
      <header className="relative mx-auto max-w-6xl px-6 sm:px-8 pt-10 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-zinc-100 ring-1 ring-inset ring-zinc-200" aria-hidden />
            <h1 className="text-[17px] font-medium tracking-tight">IELTS AI</h1>
          </div>
          <span className="text-[11px] text-zinc-500">beta</span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 sm:px-8">
        <div className="rounded-3xl border border-zinc-200/80 bg-white/80 p-8 sm:p-12 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <h2 className="text-[26px] sm:text-[30px] leading-[1.2] font-semibold tracking-tight">
            Less Distraction. More Expression.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">
            為 Writing 與 Speaking 打造清晰、精準、專注的練習體驗。
          </p>

          <QuickStart />

          {/* Primary actions */}
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <FeatureCard
              title="Writing Task 2"
              desc="即時分項評分、逐段建議、優化版本"
              href="/tasks/1/writing"
              tone="brand"
              meta={
                latestW
                  ? `最近：${fmtBand((latestW as any).band?.overall)} /9`
                  : "尚未有紀錄"
              }
            />
            <FeatureCard
              title="Speaking (Part 2)"
              desc="兩分鐘限時錄音、轉文字、口語反饋"
              href="/tasks/1/speaking"
              tone="speak"
              meta={
                latestS
                  ? `最近：${fmtBand(((latestS as any).band?.overall ?? (latestS as any).band?.content))} /9`
                  : "尚未有紀錄"
              }
            />
          </div>

          <Highlights />
          <HowItWorks />
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-6xl px-6 sm:px-8 py-10">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-6 sm:p-8 text-center shadow-sm backdrop-blur">
          <h3 className="text-[18px] font-medium tracking-tight">準備好開始了嗎？</h3>
          <p className="mt-2 text-sm text-zinc-600">從一篇作文或一次兩分鐘口說開始，建立你的進步曲線。</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/tasks/1/writing" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50">
              開始 Writing
            </Link>
            <Link href="/tasks/1/speaking" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm hover:bg-amber-100">
              開始 Speaking
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-zinc-500">目前僅提供 Writing / Speaking，其他功能將於後續釋出</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative mx-auto max-w-6xl px-6 sm:px-8 py-10">
        <p className="text-[12px] text-zinc-400">© {new Date().getFullYear()} IELTS AI</p>
      </footer>
    </main>
  );
}

/* 背景裝飾 */
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
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
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

function FeatureCard({
  title,
  desc,
  href,
  tone,
  meta,
}: {
  title: string;
  desc: string;
  href: string;
  tone: "brand" | "speak";
  meta?: string;
}) {
  const palette =
    tone === "brand"
      ? { band: "from-blue-500/70 via-sky-400/60 to-blue-500/70", ring: "ring-blue-300/40 hover:ring-blue-400/50", dot: "bg-blue-500/20" }
      : { band: "from-amber-500/70 via-orange-400/60 to-amber-500/70", ring: "ring-amber-300/40 hover:ring-amber-400/50", dot: "bg-amber-500/20" };

  return (
    <Link
      href={href}
      className={[
        "relative block overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 p-6 sm:p-7 shadow-sm backdrop-blur",
        "transition-[transform,box-shadow] duration-200 will-change-transform",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]",
        "ring-1 ring-inset", palette.ring,
      ].join(" ")}
      aria-label={title}
    >
      <div aria-hidden className={["absolute -left-8 top-0 h-full w-24 -skew-x-[14deg] opacity-90 bg-gradient-to-b", palette.band].join(" ")} />
      <div className="relative ml-6 sm:ml-8">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-inset ring-white/60 backdrop-blur bg-white/60">
            <div className={`h-full w-full rounded-xl ${palette.dot}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[17px] font-medium tracking-tight">{title}</h3>
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600">{desc}</p>
            {meta && (
              <div className="mt-3 inline-flex items-center rounded-lg border border-zinc-200 bg-white/70 px-2 py-1 text-[12px] text-zinc-700">
                {meta}
              </div>
            )}
          </div>
          <span className="ml-2 mt-1 hidden text-zinc-400 transition-colors group-hover:text-zinc-700 sm:block" aria-hidden>→</span>
        </div>
      </div>
    </Link>
  );
}

function Highlights() {
  const items = [
    { t: "真考向度評分", d: "依 IELTS 四大構面產生反饋：Task, Coherence, Lexical, Grammar" },
    { t: "可比對的進步", d: "保存每次結果，形成趨勢曲線，聚焦高影響錯誤" },
    { t: "無痛上手", d: "0 安裝、0 複雜設定，輸入即評測，2 分鐘得到可行建議" },
  ];
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.t} className="rounded-xl border border-zinc-200 bg白/70 p-4">
          <div className="text-[13px] font-medium text-zinc-900">{it.t}</div>
          <div className="mt-1 text-[12px] leading-relaxed text-zinc-600">{it.d}</div>
        </div>
      ))}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: 1, t: "輸入題目與內容", d: "Writing 貼上作文；Speaking 準備 2 分鐘主題" },
    { n: 2, t: "一鍵送出 / 錄音", d: "Writing 即時分析；Speaking 自動計時與轉文字" },
    { n: 3, t: "取得分數與建議", d: "分項評分、重點改寫、下次目標" },
  ];
  return (
    <div className="mt-10 rounded-2xl border border-zinc-200 bg-white/70 p-5">
      <div className="text-[13px] font-medium text-zinc-900">如何運作</div>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="rounded-xl border border-zinc-200 bg-white/60 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-[12px] text-zinc-700">{s.n}</span>
              <span className="text-[13px] font-medium">{s.t}</span>
            </div>
            <p className="mt-1 text-[12px] text-zinc-600">{s.d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function fmtBand(n?: number) {
  if (n == null || isNaN(n)) return "-";
  const s = Number(n).toFixed(1).replace(/\.0$/, "");
  return s;
}
