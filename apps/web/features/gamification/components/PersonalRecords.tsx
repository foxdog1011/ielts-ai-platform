"use client";

// features/gamification/components/PersonalRecords.tsx
//
// Displays a grid of personal record cards per skill dimension.
// New PRs are highlighted with a gold border and "NEW PR!" badge.

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
      <div className="animate-pulse text-sm text-zinc-400 dark:text-zinc-500">
        載入個人紀錄...
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
        尚無個人紀錄 — 完成練習後即可追蹤!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {records.map((pr) => {
        const isNew = newSet.has(pr.dimension);
        return (
          <div
            key={`${pr.type}:${pr.dimension}`}
            className={[
              "relative rounded-xl border px-4 py-3 transition-all duration-300",
              isNew
                ? "border-yellow-400 bg-yellow-50 shadow-md shadow-yellow-100 dark:border-yellow-500 dark:bg-yellow-900/20 dark:shadow-yellow-900/30"
                : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800",
            ].join(" ")}
          >
            {isNew && (
              <span className="absolute -top-2 right-2 rounded-md bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-yellow-900">
                NEW PR!
              </span>
            )}
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {typeLabel(pr.type)} · {pr.dimension}
            </div>
            <div className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-100">
              {pr.value.toFixed(1)}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              {formatDate(pr.achievedAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
