// apps/web/app/page.tsx
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { latestOfType, type HistoryRecord } from "@/lib/history";

/**
 * 精簡後的首頁：
 * - 移除底部 CTA（開始 Writing / Speaking / 抽一題）
 * - Header 只保留「歷史紀錄」、「校準曲線」
 * - 修正 Speaking union 型別存取
 */

export default async function HomePage() {
  noStore();

  const [latestW, latestS] = await Promise.all([
    latestOfType("writing").catch(() => undefined),
    latestOfType("speaking").catch(() => undefined),
  ]);

  // writing：只看 band.overall
  const latestWOverall =
    typeof latestW?.band === "object" && typeof (latestW as any)?.band?.overall === "number"
      ? (latestW as any).band.overall as number
      : undefined;

  // speaking：overall；若沒有則回退到 content（相容舊欄位）
  const latestSOverall = pickSpeakingOverall(latestS);

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <BackgroundDecor />

      {/* Header */}
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-zinc-100 ring-1 ring-inset ring-zinc-200" aria-hidden />
            <h1 className="text-[17px] font-medium tracking-tight">IELTS AI</h1>
          </div>

          <nav className="flex items-center gap-2 text-[12px]">
            <Link href="/history" className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50">
              歷史紀錄
            </Link>
            <Link href="/calibration" className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50">
              校準曲線
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="rounded-3xl border border-zinc-200/80 bg-white/80 p-8 sm:p-12 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <h2 className="text-[26px] sm:text-[30px] leading-[1.2] font-semibold tracking-tight">
            Less Distraction. More Expression.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">
            專為 IELTS Writing 與 Speaking 打造的極簡練習介面，聚焦有效回饋與進步曲線。
          </p>

          {/* 兩張主卡 */}
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <PrimaryCard
              title="Writing Task 2"
              desc="即時分項評分、逐段建議、優化版本"
              href="/tasks/1/writing"
              tone="brand"
              meta={fmtLatest(latestWOverall)}
              metaHref="/history?type=writing"
              actions={[
                { label: "開始 Writing", href: "/tasks/1/writing" },
                { label: "抽一題", href: "/tasks/1/writing?q=random", subtle: true },
              ]}
            />

            <PrimaryCard
              title="Speaking (Part 2)"
              desc="兩分鐘限時錄音、轉文字、口語反饋"
              href="/tasks/1/speaking"
              tone="speak"
              meta={fmtLatest(latestSOverall)}
              metaHref="/history?type=speaking"
              actions={[
                { label: "開始 Speaking", href: "/tasks/1/speaking" },
                { label: "抽一題", href: "/tasks/1/speaking?q=random", subtle: true },
              ]}
            />
          </div>

          {/* 三個賣點 */}
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              { t: "真考向度評分", d: "依 IELTS 四大構面產生反饋：Task, Coherence, Lexical, Grammar" },
              { t: "可比對的進步", d: "保存每次結果形成趨勢，聚焦高影響錯誤" },
              { t: "無痛上手", d: "0 安裝、0 設定，輸入即評測，2 分鐘得可行建議" },
            ].map((it) => (
              <div key={it.t} className="rounded-xl border border-zinc-200 bg-white/70 p-4">
                <div className="text-[13px] font-medium text-zinc-900">{it.t}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-zinc-600">{it.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 sm:px-8 py-10">
        <p className="text-[12px] text-zinc-400">© {new Date().getFullYear()} IELTS AI</p>
      </footer>
    </main>
  );
}

/* ---------------- helpers ---------------- */

/** 從 speaking 紀錄安全地取得 overall（兼容舊欄位 content） */
function pickSpeakingOverall(rec?: HistoryRecord): number | undefined {
  if (!rec || rec.type !== "speaking" || !rec.band) return undefined;
  const b: any = rec.band;
  if (typeof b.overall === "number") return b.overall as number;
  if (typeof b.content === "number") return b.content as number; // 兼容舊格式
  return undefined;
}

function fmtLatest(n?: number) {
  if (n == null || Number.isNaN(Number(n))) return "尚未有紀錄";
  const s = Number(n).toFixed(1).replace(/\.0$/, "");
  return `最近：${s} /9`;
}

/* ---------------- components ---------------- */

function PrimaryCard(props: {
  title: string;
  desc: string;
  href: string;
  tone: "brand" | "speak";
  meta?: string;
  metaHref?: string;
  actions?: Array<{ label: string; href: string; subtle?: boolean }>;
}) {
  const palette =
    props.tone === "brand"
      ? {
          band: "from-blue-500/70 via-sky-400/60 to-blue-500/70",
          dot: "bg-blue-500/20",
          ring: "ring-blue-300/40 hover:ring-blue-400/50",
        }
      : {
          band: "from-amber-500/70 via-orange-400/60 to-amber-500/70",
          dot: "bg-amber-500/20",
          ring: "ring-amber-300/40 hover:ring-amber-400/50",
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
      {/* 左側斜切色帶 */}
      <div
        aria-hidden
        className={["absolute -left-8 top-0 h-full w-24 -skew-x-[14deg] opacity-90 bg-gradient-to-b", palette.band].join(
          " ",
        )}
      />
      <div className="relative ml-6 sm:ml-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-inset ring-white/60 backdrop-blur bg-white/60">
              <div className={`h-full w-full rounded-xl ${palette.dot}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-medium tracking-tight">{props.title}</h3>
              </div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600">{props.desc}</p>
            </div>
          </div>

          <Link
            href={props.href}
            className="ml-auto hidden text-zinc-400 transition-colors hover:text-zinc-700 sm:block"
            aria-label={`前往 ${props.title}`}
            title={`前往 ${props.title}`}
          >
            →
          </Link>
        </div>

        {/* meta + actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {props.meta && (
            <Link
              href={props.metaHref || "#"}
              className="inline-flex items-center rounded-lg border border-zinc-200 bg-white/70 px-2 py-1 text-[12px] text-zinc-700"
              title="查看歷史"
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
                  "rounded-xl border px-3 py-1.5 text-[12px]",
                  a.subtle
                    ? "border-zinc-300 bg-white hover:bg-zinc-50"
                    : props.tone === "brand"
                    ? "border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100"
                    : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
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
