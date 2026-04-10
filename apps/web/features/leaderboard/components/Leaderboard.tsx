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
  { key: "all", label: "全部" },
  { key: "writing", label: "寫作" },
  { key: "speaking", label: "口說" },
];

const MEDAL: Record<number, string> = { 1: "👑", 2: "🥈", 3: "🥉" };

const RANK_BG: Record<number, string> = {
  1: "bg-[#FFF8E1]",
  2: "bg-[#F5F5F5]",
  3: "bg-[#FFF3E0]",
};

const RANK_BORDER: Record<number, string> = {
  1: "border-l-[#FFD900]",
  2: "border-l-[#C0C0C0]",
  3: "border-l-[#CD7F32]",
};

const RANK_ACCENT: Record<number, string> = {
  1: "#FFD900",
  2: "#C0C0C0",
  3: "#CD7F32",
};

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

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
    <div className="rounded-3xl bg-white border-2 border-gray-200 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] p-4 sm:p-6">
      {/* Duolingo-style segment pills */}
      <div className="flex gap-2 mb-6 bg-gray-100 rounded-2xl p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all min-h-[44px]",
              tab === t.key
                ? "bg-[#58CC02] text-white shadow-[0_4px_0_0_#46A302]"
                : "bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-200",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-gray-400 py-8 text-center font-bold">載入中...</p>
      )}

      {!loading && entries.length === 0 && (
        <div className="py-12 text-center">
          <span className="text-4xl block mb-3">📝</span>
          <p className="text-base text-gray-400 font-bold">
            還沒有人上榜，完成練習成為第一名！
          </p>
        </div>
      )}

      {/* Desktop table */}
      {!loading && entries.length > 0 && (
        <div className="hidden sm:block">
          <div className="grid grid-cols-[60px_1fr_100px_100px] gap-0 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-4">
            <span>排名</span>
            <span>名稱</span>
            <span className="text-right">最高分</span>
            <span className="text-right">練習數</span>
          </div>
          <div className="space-y-2">
            {entries.map((e, i) => {
              const rank = i + 1;
              const isMe = currentUserId === e.userId;
              const isTop3 = rank <= 3;
              return (
                <div
                  key={e.userId}
                  className={[
                    "grid grid-cols-[60px_1fr_100px_100px] gap-0 items-center px-4 py-3 rounded-2xl border-2 border-l-4 transition-all",
                    isMe
                      ? "border-[#58CC02] bg-[#F0FFF0] shadow-[0_2px_0_0_#58CC02]"
                      : isTop3
                        ? `${RANK_BG[rank]} ${RANK_BORDER[rank]} border-gray-100`
                        : "border-gray-100 border-l-transparent hover:bg-gray-50",
                  ].join(" ")}
                >
                  <span className="text-xl font-bold text-center">
                    {MEDAL[rank] ?? (
                      <span className="text-sm text-gray-400">#{rank}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{
                        backgroundColor: isTop3
                          ? RANK_ACCENT[rank]
                          : isMe
                            ? "#58CC02"
                            : "#CE82FF",
                      }}
                    >
                      {getInitials(e.displayName)}
                    </div>
                    <span className="font-bold text-gray-800 text-sm">
                      {e.displayName}
                      {isMe && (
                        <span className="ml-2 text-xs bg-[#58CC02] text-white px-2 py-0.5 rounded-full font-bold">
                          你
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-right">
                    <span className="inline-block bg-[#FFF3E0] text-[#FF9800] font-bold text-sm px-3 py-1 rounded-xl">
                      {e.bestBand.toFixed(1)}
                    </span>
                  </span>
                  <span className="text-right text-sm text-gray-500 font-bold">
                    {e.practiceCount} 次
                  </span>
                </div>
              );
            })}
          </div>
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
                className={[
                  "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-l-4 transition-all",
                  isMe
                    ? "border-[#58CC02] bg-[#F0FFF0] shadow-[0_2px_0_0_#58CC02]"
                    : isTop3
                      ? `${RANK_BG[rank]} ${RANK_BORDER[rank]} border-gray-100`
                      : "border-gray-100 border-l-transparent",
                ].join(" ")}
              >
                <span className="text-lg font-bold w-8 text-center shrink-0">
                  {MEDAL[rank] ?? (
                    <span className="text-sm text-gray-400">#{rank}</span>
                  )}
                </span>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{
                    backgroundColor: isTop3
                      ? RANK_ACCENT[rank]
                      : isMe
                        ? "#58CC02"
                        : "#CE82FF",
                  }}
                >
                  {getInitials(e.displayName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800 truncate">
                    {e.displayName}
                    {isMe && (
                      <span className="ml-1 text-xs bg-[#58CC02] text-white px-1.5 py-0.5 rounded-full font-bold">
                        你
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 font-bold">{e.practiceCount} 次練習</div>
                </div>
                <span className="inline-block bg-[#FFF3E0] text-[#FF9800] font-bold text-sm px-3 py-1 rounded-xl shrink-0">
                  {e.bestBand.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
