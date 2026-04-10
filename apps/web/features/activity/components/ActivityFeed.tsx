"use client";

import { useEffect, useState, useCallback } from "react";
import type { ActivityItem, ActivityApiResponse } from "@/features/activity/types";

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  writing: { label: "寫作", bg: "bg-[#E3F2FD]", text: "text-[#1CB0F6]", icon: "✍️" },
  speaking: { label: "口說", bg: "bg-[#F3E5F5]", text: "text-[#CE82FF]", icon: "🗣️" },
};

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diffSec = Math.floor((now - ts) / 1000);

  if (diffSec < 60) return "剛剛";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分鐘前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小時前`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} 天前`;

  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getBandColor(band: number): string {
  if (band >= 7.0) return "#58CC02";
  if (band >= 6.0) return "#1CB0F6";
  if (band >= 5.0) return "#FFD900";
  return "#FF4B4B";
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

const REFRESH_INTERVAL_MS = 30_000;

export function ActivityFeed() {
  const [items, setItems] = useState<readonly ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?limit=20");
      const json: ActivityApiResponse = await res.json();
      if (json.success && json.data) {
        setItems(json.data);
      }
    } catch {
      // Keep existing items on error
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  return (
    <div className="rounded-3xl bg-white border-2 border-gray-200 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <h2 className="text-xl font-bold text-gray-800">即時動態</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#58CC02] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#58CC02]" />
          </span>
          <span className="text-xs text-gray-400 font-bold">
            {formatRelativeTime(lastRefresh)}更新
          </span>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-gray-50 border-2 border-gray-100 p-4 h-20 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="py-12 text-center">
          <span className="text-4xl block mb-3">🌱</span>
          <p className="text-base text-gray-400 font-bold">
            還沒有活動紀錄，開始練習吧！
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const typeConfig = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.writing;
            const bandColor = getBandColor(item.overallBand);

            return (
              <div
                key={item.id}
                className={[
                  "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all",
                  item.isNewPR
                    ? "border-[#FFD900] bg-[#FFFDE7] shadow-[0_2px_0_0_#FFD900]"
                    : "border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200",
                ].join(" ")}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: "#CE82FF" }}
                >
                  {getInitials(item.displayName)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800 truncate">
                      {item.displayName}
                    </span>
                    <span
                      className={[
                        "rounded-xl px-2 py-0.5 text-xs font-bold border-2",
                        typeConfig.bg,
                        typeConfig.text,
                      ].join(" ")}
                    >
                      {typeConfig.icon} {typeConfig.label}
                    </span>
                    {item.taskType && (
                      <span className="text-xs text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded-lg">
                        {item.taskType}
                      </span>
                    )}
                    {item.isNewPR && (
                      <span className="rounded-xl bg-[#FFD900] text-gray-800 px-2.5 py-0.5 text-xs font-bold border-2 border-[#E6C300] animate-bounce">
                        🎉 新紀錄！
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-medium mt-0.5 block">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>

                {/* Score badge */}
                <div
                  className="shrink-0 rounded-2xl px-3 py-1.5 text-sm font-bold text-white shadow-[0_2px_0_0_rgba(0,0,0,0.15)]"
                  style={{ backgroundColor: bandColor }}
                >
                  {item.overallBand.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
