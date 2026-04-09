'use client';
// apps/web/app/goals/page.tsx

import Link from "next/link";
import { useEffect, useState } from "react";

type Goals = {
  targetBand: number;
  weeklyWriting: number;
  weeklySpeaking: number;
  updatedAt: string;
};

type Progress = {
  thisWeekWriting: number;
  thisWeekSpeaking: number;
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goals>({ targetBand: 7, weeklyWriting: 3, weeklySpeaking: 3, updatedAt: "" });
  const [progress, setProgress] = useState<Progress>({ thisWeekWriting: 0, thisWeekSpeaking: 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setGoals(json.data.goals);
          setProgress(json.data.progress);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goals),
      });
      const json = await res.json();
      if (json.ok) {
        setGoals(json.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  const writingPct = goals.weeklyWriting > 0
    ? Math.min(100, Math.round((progress.thisWeekWriting / goals.weeklyWriting) * 100))
    : 0;
  const speakingPct = goals.weeklySpeaking > 0
    ? Math.min(100, Math.round((progress.thisWeekSpeaking / goals.weeklySpeaking) * 100))
    : 0;

  return (
    <main className="min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-2xl px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[14px] sm:text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors min-h-[44px] flex items-center">← 回首頁</Link>
          <h1 className="text-[18px] font-semibold tracking-tight">練習目標</h1>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 sm:px-6 pb-12 space-y-6">

        {/* This week's progress */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm">
          <h2 className="text-[14px] font-semibold mb-4">本週進度</h2>

          <div className="space-y-4">
            <ProgressBar
              label="Writing"
              done={progress.thisWeekWriting}
              target={goals.weeklyWriting}
              pct={writingPct}
              color="#3b82f6"
            />
            <ProgressBar
              label="Speaking"
              done={progress.thisWeekSpeaking}
              target={goals.weeklySpeaking}
              pct={speakingPct}
              color="#f59e0b"
            />
          </div>
        </div>

        {/* Goal settings */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm">
          <h2 className="text-[14px] font-semibold mb-4">目標設定</h2>

          {loading ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-10 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-10 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          ) : (
            <div className="space-y-4">
              <GoalInput
                label="目標 Band 分"
                value={goals.targetBand}
                min={4}
                max={9}
                step={0.5}
                onChange={(v) => setGoals({ ...goals, targetBand: v })}
                suffix="/ 9"
              />
              <GoalInput
                label="每週 Writing 次數"
                value={goals.weeklyWriting}
                min={0}
                max={21}
                step={1}
                onChange={(v) => setGoals({ ...goals, weeklyWriting: v })}
                suffix="次"
              />
              <GoalInput
                label="每週 Speaking 次數"
                value={goals.weeklySpeaking}
                min={0}
                max={21}
                step={1}
                onChange={(v) => setGoals({ ...goals, weeklySpeaking: v })}
                suffix="次"
              />

              <div className="flex items-center justify-between pt-2">
                {goals.updatedAt && (
                  <span className="text-[11px] text-zinc-400">
                    上次更新：{new Date(goals.updatedAt).toLocaleDateString("zh-TW")}
                  </span>
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  className={[
                    "ml-auto rounded-xl border px-4 py-2.5 sm:py-2 min-h-[44px] text-[14px] sm:text-[13px] font-medium transition-colors",
                    saved
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : saving
                      ? "cursor-wait border-zinc-200 bg-zinc-100 text-zinc-400"
                      : "border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100",
                  ].join(" ")}
                >
                  {saved ? "已儲存 ✓" : saving ? "儲存中…" : "儲存目標"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm">
          <h2 className="text-[13px] font-semibold mb-3 text-zinc-700">練習建議</h2>
          <ul className="space-y-2 text-[12px] text-zinc-600">
            {[
              "Band 6 → 7：每週至少 3 篇 Writing + 3 次 Speaking，持續 4-6 週",
              "集中攻弱點維度比全面練習更有效率",
              "Writing 每次結束後對照 AI 建議改寫一段",
              "Speaking 可重聽錄音找自己不自然的停頓",
            ].map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-zinc-400 shrink-0">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function ProgressBar({
  label,
  done,
  target,
  pct,
  color,
}: {
  label: string;
  done: number;
  target: number;
  pct: number;
  color: string;
}) {
  const complete = done >= target && target > 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] text-zinc-700">{label}</span>
        <span className={`text-[12px] font-semibold ${complete ? "text-emerald-600" : "text-zinc-600"}`}>
          {done} / {target} 次{complete ? " ✓" : ""}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: complete ? "#10b981" : color }}
        />
      </div>
    </div>
  );
}

function GoalInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-[14px] sm:text-[13px] text-zinc-700 flex-1">{label}</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg border border-zinc-200 bg-white text-[16px] sm:text-[14px] hover:bg-zinc-50 transition-colors flex items-center justify-center"
        >
          −
        </button>
        <span className="w-12 text-center text-[15px] sm:text-[14px] font-semibold text-zinc-900">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg border border-zinc-200 bg-white text-[16px] sm:text-[14px] hover:bg-zinc-50 transition-colors flex items-center justify-center"
        >
          +
        </button>
        {suffix && <span className="text-[13px] sm:text-[12px] text-zinc-400 w-8">{suffix}</span>}
      </div>
    </div>
  );
}
