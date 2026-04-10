"use client";

// features/gamification/components/PersonalRecords.tsx
//
// Displays a grid of personal record cards per skill dimension.
// New PRs are highlighted with a gold border and badge.

import { useEffect, useState, useCallback } from "react";
import type { PersonalRecord } from "@/features/gamification/pr-service";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface PRResponse {
  readonly ok: boolean;
  readonly data?: { readonly records: readonly PersonalRecord[] };
  readonly error?: string;
}

interface PersonalRecordsProps {
  /** Dimensions that were just achieved as new PRs (for highlighting). */
  readonly newPRDimensions?: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-TW", {
    month: "short",
    day: "numeric",
  });
}

function typeLabel(type: string): string {
  return type === "writing" ? "寫作" : type === "speaking" ? "口說" : type;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function PersonalRecords({ newPRDimensions = [] }: PersonalRecordsProps) {
  const [records, setRecords] = useState<readonly PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const newSet = new Set(newPRDimensions);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification/pr");
      if (!res.ok) return;
      const json: PRResponse = await res.json();
      if (json.data?.records) {
        setRecords(json.data.records);
      }
    } catch {
      // Silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  if (loading) {
    return (
      <div className="animate-pulse text-sm font-bold text-gray-400">
        載入個人紀錄...
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm font-bold text-gray-400 shadow-[4px_4px_0_0_rgba(0,0,0,0.05)]">
        🏅 尚無個人紀錄 — 完成練習後即可追蹤!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {records.map((pr) => {
        const isNew = newSet.has(pr.dimension);
        return (
          <div
            key={`${pr.type}:${pr.dimension}`}
            className={[
              "relative rounded-2xl border-2 px-4 py-4 transition-all duration-300 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]",
              isNew
                ? "border-[#FFD900] bg-[#FFD900]/10 shadow-[4px_4px_0_0_rgba(255,217,0,0.3)]"
                : "border-gray-200 bg-white",
            ].join(" ")}
          >
            {isNew && (
              <span className="absolute -top-2.5 right-2 rounded-xl bg-[#FFD900] px-2 py-0.5 text-[11px] font-bold text-[#7A6200] shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">
                🏆 新紀錄!
              </span>
            )}
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-400">
              {typeLabel(pr.type)} · {pr.dimension}
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-800">
              {pr.value.toFixed(1)}
            </div>
            <div className="mt-1 text-[12px] font-bold text-gray-400">
              {formatDate(pr.achievedAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
