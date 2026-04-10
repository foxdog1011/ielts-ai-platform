"use client";
// apps/web/app/dashboard/page.tsx — Analytics Dashboard (Duolingo style, 繁體中文)

import Link from "next/link";
import { useEffect, useState } from "react";

/* ── Color tokens ── */
const GREEN = "#58CC02";
const YELLOW = "#FFD900";
const CORAL = "#FF4B4B";
const BLUE = "#1CB0F6";
const PURPLE = "#CE82FF";

/* ── Types ── */

type TrendPoint = { score: number; date: string };
type SkillTrend = { skill: string; average: number; trend: number[]; dates: string[]; count: number };
type WeaknessItem = { skill: string; dimension: string; average: number; suggestion: string };
type WeeklyCount = { weekLabel: string; writing: number; speaking: number };
type RecentScore = { type: "writing" | "speaking"; overall: number | null; date: string; taskId: string; prompt?: string };

type DashboardData = {
  overallTrend: TrendPoint[];
  skillBreakdown: SkillTrend[];
  weaknesses: WeaknessItem[];
  weeklyPractice: WeeklyCount[];
  recentScores: RecentScore[];
  totalSessions: number;
  averageBand: number;
};

/* ── Page ── */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setData(json.data);
        } else {
          setError(json.error?.message ?? "載入失敗");
        }
      })
      .catch(() => setError("無法連線到伺服器"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-dvh bg-[#F7F5FF] text-gray-800 font-brand">
      {/* Header */}
      <header className="mx-auto max-w-4xl px-4 sm:px-8 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-2xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold min-h-[44px] flex items-center hover:border-[#58CC02] hover:text-[#58CC02] transition-all shadow-[3px_3px_0_0_rgba(0,0,0,0.08)]"
          >
            &larr; 首頁
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-3xl">📊</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">學習分析</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 sm:px-8 pb-12 space-y-6">
        {loading && <LoadingSkeleton />}
        {error && <ErrorCard message={error} />}
        {data && !loading && <DashboardContent data={data} />}
      </section>
    </main>
  );
}

/* ── Dashboard Content ── */

function DashboardContent({ data }: { data: DashboardData }) {
  const isEmpty = data.totalSessions === 0;

  if (isEmpty) {
    return (
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-10 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
        <div className="text-5xl mb-4">📝</div>
        <p className="text-lg font-bold text-gray-700 mb-2">還沒有練習記錄</p>
        <p className="text-sm text-gray-500 mb-6">完成你的第一次練習，這裡就會顯示你的學習數據</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/tasks/1/writing"
            className="rounded-2xl border-2 border-b-4 border-[#58CC02] bg-[#58CC02] px-6 py-3 text-sm font-bold text-white hover:brightness-110 transition-all"
          >
            開始寫作
          </Link>
          <Link
            href="/tasks/1/speaking"
            className="rounded-2xl border-2 border-b-4 border-[#1CB0F6] bg-[#1CB0F6] px-6 py-3 text-sm font-bold text-white hover:brightness-110 transition-all"
          >
            開始口說
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="總練習次數" value={String(data.totalSessions)} color={GREEN} icon="🎯" />
        <StatCard label="平均分數" value={data.averageBand > 0 ? data.averageBand.toFixed(1) : "—"} color={BLUE} icon="📈" />
        {data.skillBreakdown.map((s) => (
          <StatCard
            key={s.skill}
            label={`${s.skill} 平均`}
            value={s.average > 0 ? s.average.toFixed(1) : "—"}
            color={s.skill === "Writing" ? PURPLE : YELLOW}
            icon={s.skill === "Writing" ? "✍️" : "🎤"}
          />
        ))}
      </div>

      {/* Overall trend chart */}
      {data.overallTrend.length > 1 && (
        <Card title="整體分數趨勢" icon="📈">
          <LineChart points={data.overallTrend} color={GREEN} height={180} />
        </Card>
      )}

      {/* Skill breakdown */}
      {data.skillBreakdown.length > 0 && (
        <Card title="各技能趨勢" icon="📋">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {data.skillBreakdown.map((sk) => (
              <div key={sk.skill}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-700">{sk.skill}</span>
                  <span className="text-xs text-gray-500">{sk.count} 次練習</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold" style={{ color: sk.skill === "Writing" ? PURPLE : YELLOW }}>
                    {sk.average.toFixed(1)}
                  </span>
                  <div className="flex-1">
                    <MiniLineChart values={sk.trend} color={sk.skill === "Writing" ? PURPLE : YELLOW} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weekly practice */}
      {data.weeklyPractice.some((w) => w.writing > 0 || w.speaking > 0) && (
        <Card title="練習頻率（近 6 週）" icon="📅">
          <BarChart data={data.weeklyPractice} />
        </Card>
      )}

      {/* Weakness analysis */}
      {data.weaknesses.length > 0 && (
        <Card title="弱點分析" icon="🔍">
          <div className="space-y-3">
            {data.weaknesses.slice(0, 5).map((w, i) => (
              <div
                key={`${w.skill}-${w.dimension}`}
                className="flex items-start gap-3 rounded-xl border-2 border-gray-100 bg-gray-50 p-4"
              >
                <div
                  className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm border-2 border-b-4"
                  style={{
                    backgroundColor: w.average < 5.5 ? CORAL : w.average < 6.5 ? YELLOW : GREEN,
                    borderColor: w.average < 5.5 ? "#E63E3E" : w.average < 6.5 ? "#E6C300" : "#4CAF00",
                  }}
                >
                  {w.average.toFixed(1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-800">{w.dimension}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: w.skill === "Writing" ? "#F3E8FF" : "#FEF9C3",
                        color: w.skill === "Writing" ? "#7C3AED" : "#A16207",
                      }}
                    >
                      {w.skill}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{w.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent scores */}
      {data.recentScores.length > 0 && (
        <Card title="最近成績" icon="📝">
          <div className="space-y-2">
            {data.recentScores.map((s, i) => (
              <div
                key={`${s.taskId}-${s.date}-${i}`}
                className="flex items-center gap-3 rounded-xl border-2 border-gray-100 bg-white px-4 py-3"
              >
                <div
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: s.type === "writing" ? PURPLE : YELLOW }}
                >
                  {s.type === "writing" ? "W" : "S"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {s.prompt || `${s.type === "writing" ? "寫作" : "口說"}練習`}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(s.date)}</p>
                </div>
                <div className="text-lg font-bold" style={{ color: getBandColor(s.overall) }}>
                  {s.overall !== null ? s.overall.toFixed(1) : "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Link to coach */}
      <Link
        href="/coach"
        className="block rounded-2xl border-2 border-b-4 border-[#58CC02] bg-[#58CC02] p-6 text-center hover:brightness-110 transition-all shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]"
      >
        <span className="text-3xl block mb-2">🤖</span>
        <span className="text-lg font-bold text-white">前往 AI 教練 — 查看個人化學習計畫</span>
      </Link>
    </>
  );
}

/* ── SVG Line Chart (no external lib) ── */

function LineChart({ points, color, height }: { points: TrendPoint[]; color: string; height: number }) {
  if (points.length < 2) return null;

  const W = 600;
  const H = height;
  const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const scores = points.map((p) => p.score);
  const minS = Math.max(0, Math.floor(Math.min(...scores) - 0.5));
  const maxS = Math.min(9, Math.ceil(Math.max(...scores) + 0.5));
  const range = maxS - minS || 1;

  const toX = (i: number) => PAD.left + (i / (points.length - 1)) * plotW;
  const toY = (s: number) => PAD.top + plotH - ((s - minS) / range) * plotH;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.score).toFixed(1)}`)
    .join(" ");

  // Grid lines
  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = minS + (range * i) / gridSteps;
    return { y: toY(val), label: val.toFixed(1) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} stroke="#E5E7EB" strokeWidth={1} />
          <text x={PAD.left - 8} y={g.y + 4} textAnchor="end" fontSize={11} fill="#9CA3AF">
            {g.label}
          </text>
        </g>
      ))}

      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.score)} r={4} fill="white" stroke={color} strokeWidth={2.5} />
      ))}

      {/* X-axis labels (show first, mid, last) */}
      {[0, Math.floor(points.length / 2), points.length - 1].map((idx) => {
        const p = points[idx];
        if (!p) return null;
        return (
          <text key={idx} x={toX(idx)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9CA3AF">
            {p.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Mini trend line ── */

function MiniLineChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <div className="h-8 flex items-center text-xs text-gray-400">資料不足</div>;
  }

  const W = 120;
  const H = 32;
  const minV = Math.min(...values) - 0.2;
  const maxV = Math.max(...values) + 0.2;
  const range = maxV - minV || 1;

  const pathD = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - minV) / range) * H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8">
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Bar Chart (weekly practice) ── */

function BarChart({ data }: { data: WeeklyCount[] }) {
  const maxVal = Math.max(1, ...data.map((d) => d.writing + d.speaking));
  const barW = 28;
  const gap = 12;
  const W = data.length * (barW * 2 + gap * 2) + gap;
  const H = 140;
  const plotH = 100;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const groupX = gap + i * (barW * 2 + gap * 2);
        const wH = (d.writing / maxVal) * plotH;
        const sH = (d.speaking / maxVal) * plotH;
        return (
          <g key={d.weekLabel}>
            {/* Writing bar */}
            <rect
              x={groupX}
              y={plotH - wH + 10}
              width={barW}
              height={Math.max(wH, 2)}
              rx={6}
              fill={PURPLE}
              opacity={0.85}
            />
            {d.writing > 0 && (
              <text x={groupX + barW / 2} y={plotH - wH + 6} textAnchor="middle" fontSize={10} fill={PURPLE} fontWeight="bold">
                {d.writing}
              </text>
            )}

            {/* Speaking bar */}
            <rect
              x={groupX + barW + 4}
              y={plotH - sH + 10}
              width={barW}
              height={Math.max(sH, 2)}
              rx={6}
              fill={YELLOW}
              opacity={0.85}
            />
            {d.speaking > 0 && (
              <text x={groupX + barW + 4 + barW / 2} y={plotH - sH + 6} textAnchor="middle" fontSize={10} fill="#A16207" fontWeight="bold">
                {d.speaking}
              </text>
            )}

            {/* Week label */}
            <text x={groupX + barW + 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#9CA3AF">
              {d.weekLabel}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={W - 120} y={2} width={10} height={10} rx={3} fill={PURPLE} />
      <text x={W - 106} y={11} fontSize={10} fill="#6B7280">Writing</text>
      <rect x={W - 60} y={2} width={10} height={10} rx={3} fill={YELLOW} />
      <text x={W - 46} y={11} fontSize={10} fill="#6B7280">Speaking</text>
    </svg>
  );
}

/* ── Shared Components ── */

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-800 mb-4">
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-[3px_3px_0_0_rgba(0,0,0,0.08)] hover:translate-y-[-2px] transition-transform">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
          <div className="h-5 w-32 bg-gray-100 rounded-lg animate-pulse mb-4" />
          <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border-2 border-[#FF4B4B] bg-red-50 p-6 shadow-[4px_4px_0_0_rgba(255,75,75,0.15)]">
      <p className="text-sm font-bold text-[#FF4B4B]">載入錯誤</p>
      <p className="text-sm text-gray-600 mt-1">{message}</p>
    </div>
  );
}

/* ── Helpers ── */

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
}

function getBandColor(band: number | null): string {
  if (band === null) return "#9CA3AF";
  if (band >= 7) return GREEN;
  if (band >= 6) return BLUE;
  if (band >= 5) return YELLOW;
  return CORAL;
}
