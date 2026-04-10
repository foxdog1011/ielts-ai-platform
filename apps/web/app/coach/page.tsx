"use client";
// apps/web/app/coach/page.tsx — AI Coach with personalized learning path (Duolingo style, 繁體中文)

import Link from "next/link";
import { useEffect, useState } from "react";

/* ── Color tokens ── */
const GREEN = "#58CC02";
const YELLOW = "#FFD900";
const CORAL = "#FF4B4B";
const BLUE = "#1CB0F6";
const PURPLE = "#CE82FF";

/* ── Types ── */

type Recommendation = {
  priority: "high" | "medium" | "low";
  skill: string;
  dimension: string;
  action: string;
  reason: string;
};

type Milestone = {
  icon: string;
  label: string;
  achieved: boolean;
  progress: number;
  target: number;
};

type DailyPlan = {
  skill: string;
  taskType: string;
  reason: string;
};

type CoachData = {
  recommendations: Recommendation[];
  milestones: Milestone[];
  dailyPlan: DailyPlan[];
  strengths: { skill: string; dimension: string; average: number }[];
  streakDays: number;
  totalPractice: number;
};

type GoalsData = {
  targetBand: number;
  weeklyWriting: number;
  weeklySpeaking: number;
};

type DashboardData = {
  averageBand: number;
  skillBreakdown: { skill: string; average: number }[];
};

const ICON_MAP: Record<string, string> = {
  pencil: "✍️",
  mic: "🎤",
  star: "⭐",
  trophy: "🏆",
  fire: "🔥",
  rocket: "🚀",
};

/* ── Page ── */

export default function CoachPage() {
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [goals, setGoals] = useState<GoalsData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/coach").then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/dashboard").then((r) => r.json()),
    ])
      .then(([coachJson, goalsJson, dashJson]) => {
        if (coachJson.ok) setCoach(coachJson.data);
        if (goalsJson.ok) setGoals(goalsJson.data.goals);
        if (dashJson.ok) setDashboard(dashJson.data);
        if (!coachJson.ok) setError(coachJson.error?.message ?? "載入失敗");
      })
      .catch(() => setError("無法連線到伺服器"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-dvh bg-[#F7F5FF] text-gray-800 font-brand">
      {/* Header */}
      <header className="mx-auto max-w-3xl px-4 sm:px-8 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-2xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold min-h-[44px] flex items-center hover:border-[#58CC02] hover:text-[#58CC02] transition-all shadow-[3px_3px_0_0_rgba(0,0,0,0.08)]"
          >
            &larr; 首頁
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-3xl">🤖</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">AI 教練</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 sm:px-8 pb-12 space-y-6">
        {loading && <LoadingSkeleton />}
        {error && <ErrorCard message={error} />}
        {coach && !loading && (
          <CoachContent coach={coach} goals={goals} dashboard={dashboard} />
        )}
      </section>
    </main>
  );
}

/* ── Coach Content ── */

function CoachContent({
  coach,
  goals,
  dashboard,
}: {
  coach: CoachData;
  goals: GoalsData | null;
  dashboard: DashboardData | null;
}) {
  const targetBand = goals?.targetBand ?? 7;
  const currentBand = dashboard?.averageBand ?? 0;
  const gap = currentBand > 0 ? Math.max(0, targetBand - currentBand) : 0;
  const progressPct = currentBand > 0 ? Math.min(100, (currentBand / targetBand) * 100) : 0;

  return (
    <>
      {/* Streak + Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatBadge icon="🔥" label="連續練習" value={`${coach.streakDays} 天`} color={CORAL} />
        <StatBadge icon="🎯" label="總練習" value={`${coach.totalPractice} 次`} color={GREEN} />
        <StatBadge icon="💪" label="強項數" value={`${coach.strengths.length} 個`} color={BLUE} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Target Band Progress */}
      <Card title="目標進度" icon="🎯">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                目前平均：<span className="font-bold" style={{ color: getBandColor(currentBand) }}>{currentBand > 0 ? currentBand.toFixed(1) : "—"}</span>
              </span>
              <span className="text-sm text-gray-600">
                目標：<span className="font-bold text-gray-900">Band {targetBand}</span>
              </span>
            </div>
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden border-2 border-gray-200">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%`, backgroundColor: GREEN }}
              />
            </div>
          </div>
        </div>
        {gap > 0 && (
          <p className="text-sm text-gray-600">
            距離目標還差 <span className="font-bold" style={{ color: CORAL }}>{gap.toFixed(1)}</span> 分，持續努力！
          </p>
        )}
        {gap === 0 && currentBand > 0 && (
          <p className="text-sm font-bold" style={{ color: GREEN }}>
            恭喜！你已達到目標分數！繼續保持！
          </p>
        )}
        {currentBand === 0 && (
          <p className="text-sm text-gray-500">完成練習後就能追蹤目標進度</p>
        )}
        <Link
          href="/goals"
          className="inline-block mt-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:border-[#58CC02] hover:text-[#58CC02] transition-all"
        >
          調整目標設定
        </Link>
      </Card>

      {/* Per-skill gap toward target */}
      {dashboard && dashboard.skillBreakdown.length > 0 && (
        <Card title="各技能與目標差距" icon="📊">
          <div className="space-y-4">
            {dashboard.skillBreakdown.map((sk) => {
              const skillGap = Math.max(0, targetBand - sk.average);
              const pct = sk.average > 0 ? Math.min(100, (sk.average / targetBand) * 100) : 0;
              const color = sk.skill === "Writing" ? PURPLE : YELLOW;
              return (
                <div key={sk.skill}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-700">{sk.skill}</span>
                    <span className="text-xs text-gray-500">
                      {sk.average.toFixed(1)} / {targetBand}{" "}
                      {skillGap > 0 && <span style={{ color: CORAL }}>(差 {skillGap.toFixed(1)})</span>}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Daily Plan */}
      <Card title="今日建議練習" icon="📋">
        <div className="space-y-3">
          {coach.dailyPlan.map((plan, i) => (
            <div
              key={`${plan.skill}-${i}`}
              className="flex items-start gap-3 rounded-2xl border-2 border-gray-100 bg-gradient-to-r from-white to-gray-50 p-4"
            >
              <div
                className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border-2 border-b-4"
                style={{
                  backgroundColor: plan.skill === "Writing" ? "#F3E8FF" : "#FEF9C3",
                  borderColor: plan.skill === "Writing" ? "#CE82FF" : "#FFD900",
                }}
              >
                {plan.skill === "Writing" ? "✍️" : "🎤"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">{plan.taskType}</p>
                <p className="text-xs text-gray-500 mt-1">{plan.reason}</p>
              </div>
              <Link
                href={plan.skill === "Writing" ? "/tasks/1/writing" : "/tasks/1/speaking"}
                className="shrink-0 rounded-xl border-2 border-b-4 px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110"
                style={{
                  backgroundColor: plan.skill === "Writing" ? PURPLE : BLUE,
                  borderColor: plan.skill === "Writing" ? "#B066E0" : "#0E9ADE",
                }}
              >
                開始
              </Link>
            </div>
          ))}
        </div>
      </Card>

      {/* Recommendations */}
      {coach.recommendations.length > 0 && (
        <Card title="個人化建議" icon="💡">
          <div className="space-y-3">
            {coach.recommendations.map((rec, i) => (
              <div
                key={`${rec.skill}-${rec.dimension}-${i}`}
                className="rounded-2xl border-2 p-4"
                style={{
                  borderColor: rec.priority === "high" ? "#FFB3B3" : rec.priority === "medium" ? "#FFE4A0" : "#D1FAE5",
                  backgroundColor: rec.priority === "high" ? "#FFF5F5" : rec.priority === "medium" ? "#FFFBEB" : "#F0FDF4",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <PriorityBadge priority={rec.priority} />
                  <span className="text-sm font-bold text-gray-800">{rec.skill} — {rec.dimension}</span>
                </div>
                <p className="text-sm text-gray-700 font-medium mb-1">{rec.action}</p>
                <p className="text-xs text-gray-500">{rec.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Strengths */}
      {coach.strengths.length > 0 && (
        <Card title="你的強項" icon="💪">
          <div className="flex flex-wrap gap-2">
            {coach.strengths.map((s) => (
              <div
                key={`${s.skill}-${s.dimension}`}
                className="flex items-center gap-2 rounded-2xl border-2 border-[#D1FAE5] bg-[#ECFDF5] px-4 py-2"
              >
                <span className="text-lg">⭐</span>
                <div>
                  <span className="text-sm font-bold text-gray-800">{s.dimension}</span>
                  <span className="text-xs text-gray-500 ml-2">{s.skill}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: GREEN }}>{s.average.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Milestones */}
      <Card title="學習里程碑" icon="🏅">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coach.milestones.map((m) => (
            <MilestoneCard key={m.label} milestone={m} />
          ))}
        </div>
      </Card>

      {/* Link to dashboard */}
      <Link
        href="/dashboard"
        className="block rounded-2xl border-2 border-b-4 border-[#1CB0F6] bg-[#1CB0F6] p-6 text-center hover:brightness-110 transition-all shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]"
      >
        <span className="text-3xl block mb-2">📊</span>
        <span className="text-lg font-bold text-white">前往學習分析 — 查看詳細數據</span>
      </Link>
    </>
  );
}

/* ── Sub-components ── */

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const pct = milestone.target > 0 ? Math.min(100, (milestone.progress / milestone.target) * 100) : 0;
  const icon = ICON_MAP[milestone.icon] ?? "🎯";

  return (
    <div
      className="rounded-2xl border-2 p-4 transition-all"
      style={{
        borderColor: milestone.achieved ? "#A3E635" : "#E5E7EB",
        backgroundColor: milestone.achieved ? "#F7FEE7" : "#FFFFFF",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border-2 border-b-4"
          style={{
            backgroundColor: milestone.achieved ? "#ECFCCB" : "#F3F4F6",
            borderColor: milestone.achieved ? "#84CC16" : "#D1D5DB",
          }}
        >
          {milestone.achieved ? "✅" : icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${milestone.achieved ? "text-green-700" : "text-gray-700"}`}>
            {milestone.label}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: milestone.achieved ? GREEN : BLUE,
                }}
              />
            </div>
            <span className="text-xs font-bold text-gray-500 shrink-0">
              {milestone.progress}/{milestone.target}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const config = {
    high: { bg: CORAL, label: "重要" },
    medium: { bg: YELLOW, label: "建議" },
    low: { bg: GREEN, label: "不錯" },
  };
  const { bg, label } = config[priority];
  return (
    <span
      className="rounded-lg px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: bg }}
    >
      {label}
    </span>
  );
}

function StatBadge({
  icon,
  label,
  value,
  color,
  className = "",
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-[3px_3px_0_0_rgba(0,0,0,0.08)] ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold" style={{ color }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

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

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-[3px_3px_0_0_rgba(0,0,0,0.08)]">
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mb-2" />
            <div className="h-6 w-12 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
          <div className="h-5 w-32 bg-gray-100 rounded-lg animate-pulse mb-4" />
          <div className="h-24 bg-gray-50 rounded-xl animate-pulse" />
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

function getBandColor(band: number): string {
  if (band >= 7) return GREEN;
  if (band >= 6) return BLUE;
  if (band >= 5) return YELLOW;
  return CORAL;
}
