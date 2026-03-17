'use client';

// ── Shared types (mirrors coach.ts output shape) ──────────────────────────────

export type CoachSnapshotData = {
  learnerProfile: {
    totalSessions: number;
    avgBandLast5: number | null;
    bestBand: number | null;
    recentTrend: string;
    persistentWeaknesses: string[];
    engagementDays: number;
    topicCount: number;
    recurringAnomalies: string[];
  };
  coachSummary: {
    headline: string;
    keyInsight: string;
    encouragement: string;
    sessionLabel: string;
  };
  nextActionCandidate: {
    taskType: string;
    targetDimension: string;
    priority: 'urgent' | 'normal' | 'maintenance';
    rationale: string;
  };
  weeklySummaryPreview: {
    sessionCountThisWeek: number;
    bandDeltaThisWeek: number | null;
    topWeaknessThisWeek: string | null;
    consistencyRating: 'high' | 'medium' | 'low';
    summaryLine: string;
  };
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  urgent:      { label: '🚨 緊急重點', cls: 'border-red-200 bg-red-50 text-red-700' },
  normal:      { label: '📌 一般重點', cls: 'border-zinc-200 bg-zinc-50 text-zinc-700' },
  maintenance: { label: '✅ 保持維持', cls: 'border-green-200 bg-green-50 text-green-700' },
} as const;

const CONSISTENCY_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high:   '本週高頻練習',
  medium: '本週穩定練習',
  low:    '本週練習偏少',
};

// ── Component ─────────────────────────────────────────────────────────────────

type CoachBlockProps = {
  snapshot: CoachSnapshotData;
};

export function CoachBlock({ snapshot }: CoachBlockProps) {
  const { coachSummary, nextActionCandidate, weeklySummaryPreview, learnerProfile } = snapshot;
  const pc = PRIORITY_CONFIG[nextActionCandidate.priority];

  const deltaSign = weeklySummaryPreview.bandDeltaThisWeek !== null
    ? weeklySummaryPreview.bandDeltaThisWeek > 0
      ? `+${weeklySummaryPreview.bandDeltaThisWeek}`
      : String(weeklySummaryPreview.bandDeltaThisWeek)
    : null;

  return (
    <div className="mt-4 border-t border-zinc-100 pt-3 space-y-3">
      {/* Header: session label + headline */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-400">{coachSummary.sessionLabel}</span>
          {learnerProfile.totalSessions > 0 && learnerProfile.bestBand !== null && (
            <span className="text-[10px] text-zinc-400">歷史最高 Band {learnerProfile.bestBand}</span>
          )}
        </div>
        <div className="text-[13px] font-semibold text-zinc-800 leading-snug">
          {coachSummary.headline}
        </div>
      </div>

      {/* Key insight */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2">
        <div className="text-[10px] text-zinc-400 mb-0.5">學習洞察</div>
        <div className="text-[12px] text-zinc-700 leading-relaxed">{coachSummary.keyInsight}</div>
      </div>

      {/* Next action */}
      <div>
        <div className="mb-1 text-[10px] text-zinc-400">下一步行動</div>
        <div className={`rounded-lg border px-2.5 py-2 ${pc.cls}`}>
          <div className="text-[10px] font-medium mb-0.5">{pc.label}</div>
          <div className="text-[12px] leading-relaxed">{nextActionCandidate.rationale}</div>
        </div>
      </div>

      {/* Weekly preview */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-zinc-400">
            {CONSISTENCY_LABEL[weeklySummaryPreview.consistencyRating]}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <span>{weeklySummaryPreview.sessionCountThisWeek} 次</span>
            {deltaSign !== null && (
              <span className={weeklySummaryPreview.bandDeltaThisWeek! > 0 ? 'text-green-600' : weeklySummaryPreview.bandDeltaThisWeek! < 0 ? 'text-red-500' : ''}>
                {deltaSign}
              </span>
            )}
          </div>
        </div>
        <div className="text-[12px] text-zinc-600">{weeklySummaryPreview.summaryLine}</div>
      </div>

      {/* Encouragement */}
      <div className="text-[11px] italic text-zinc-400 text-right">
        {coachSummary.encouragement}
      </div>
    </div>
  );
}
