"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly bestBand: number;
  readonly practiceCount: number;
  readonly lastActiveAt: string;
}

type TabType = "all" | "writing" | "speaking";

const TABS: readonly { readonly key: TabType; readonly label: string }[] = [
  { key: "all", label: "All" },
  { key: "writing", label: "Writing" },
  { key: "speaking", label: "Speaking" },
];

const MEDAL: Record<number, string> = { 1: "\u{1F947}", 2: "\u{1F948}", 3: "\u{1F949}" };
const MEDAL_BG: Record<number, string> = {
  1: "rgba(255,215,0,0.15)",
  2: "rgba(192,192,192,0.15)",
  3: "rgba(205,127,50,0.15)",
};
const MEDAL_BORDER: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

export function Leaderboard({ currentUserId }: { readonly currentUserId?: string }) {
  const [tab, setTab] = useState<TabType>("all");
  const [entries, setEntries] = useState<readonly LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?type=${tab}`)
      .then((r) => r.json())
      .then((j) => setEntries(j.data ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="glass-card p-4 sm:p-6">
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "rounded-xl px-4 py-2 text-[13px] font-medium theme-transition min-h-[44px]",
              tab === t.key
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--color-primary-200)]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-[13px] text-[var(--text-muted)] py-8 text-center">Loading...</p>}

      {!loading && entries.length === 0 && (
        <p className="text-[13px] text-[var(--text-muted)] py-8 text-center">No entries yet. Complete a practice to appear!</p>
      )}

      {/* Desktop table */}
      {!loading && entries.length > 0 && (
        <div className="hidden sm:block">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[var(--text-muted)] text-[11px] uppercase tracking-wide">
                <th className="pb-3 pl-3 w-16">Rank</th>
                <th className="pb-3">Name</th>
                <th className="pb-3 text-right">Best Band</th>
                <th className="pb-3 text-right pr-3">Practices</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const rank = i + 1;
                const isMe = currentUserId === e.userId;
                const isTop3 = rank <= 3;
                return (
                  <tr
                    key={e.userId}
                    className="theme-transition"
                    style={{
                      backgroundColor: isMe ? "var(--color-primary-50)" : isTop3 ? MEDAL_BG[rank] : undefined,
                      borderLeft: isTop3 ? `3px solid ${MEDAL_BORDER[rank]}` : isMe ? "3px solid var(--color-primary)" : "3px solid transparent",
                    }}
                  >
                    <td className="py-2.5 pl-3 font-semibold">{MEDAL[rank] ?? `#${rank}`}</td>
                    <td className="py-2.5 font-medium text-[var(--text)]">{e.displayName}{isMe && <span className="ml-2 text-[11px] text-[var(--color-primary)]">(you)</span>}</td>
                    <td className="py-2.5 text-right font-bold text-[var(--text)]">{e.bestBand.toFixed(1)}</td>
                    <td className="py-2.5 text-right pr-3 text-[var(--text-muted)]">{e.practiceCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && entries.length > 0 && (
        <div className="sm:hidden space-y-2">
          {entries.map((e, i) => {
            const rank = i + 1;
            const isMe = currentUserId === e.userId;
            const isTop3 = rank <= 3;
            return (
              <div
                key={e.userId}
                className="glass-card-sm px-4 py-3 flex items-center gap-3 theme-transition"
                style={{
                  backgroundColor: isMe ? "var(--color-primary-50)" : isTop3 ? MEDAL_BG[rank] : undefined,
                  borderColor: isTop3 ? MEDAL_BORDER[rank] : isMe ? "var(--color-primary)" : undefined,
                }}
              >
                <span className="text-[16px] font-bold w-8 text-center shrink-0">{MEDAL[rank] ?? `#${rank}`}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text)] truncate">{e.displayName}{isMe && <span className="ml-1 text-[11px] text-[var(--color-primary)]">(you)</span>}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{e.practiceCount} practices</div>
                </div>
                <span className="text-[15px] font-bold text-[var(--text)] shrink-0">{e.bestBand.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
