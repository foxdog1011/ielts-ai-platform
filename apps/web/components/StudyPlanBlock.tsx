'use client';

// ── Shared types ──────────────────────────────────────────────────────────────

export type StudyPlanDim = {
  dimension: string;
  currentBand: number | null;
  gapToOverall: number;
  diagnosisFlag?: string;
};

/** Mirrors CurrentFocus.reason from lib/planner.ts — kept in sync manually. */
export type FocusReason = 'diagnosis_flagged' | 'repeated_weakness' | 'current_weakest';

export type StudyPlan = {
  priorityDimensions: StudyPlanDim[];
  currentFocus?: { dimension: string; reason: FocusReason | string };
  repeatedWeaknesses?: string[];
  progressStatus?: 'first_session' | 'improving' | 'stable' | 'declining';
  nextTaskRecommendation: string;
  milestoneBand: number;
  practiceItems: string[];
  trendNote?: string;
  reliabilityNote?: string;
  planSource: string;
  sessionCount?: number;
};

// ── Internal constants ────────────────────────────────────────────────────────

const PROGRESS_STATUS_SHARED = {
  improving: { label: '進步中 ↑', cls: 'border-green-200 bg-green-50 text-green-700' },
  stable:    { label: '持平 →',   cls: 'border-zinc-200 bg-zinc-50 text-zinc-600' },
  declining: { label: '需加強 ↓', cls: 'border-orange-200 bg-orange-50 text-orange-700' },
} as const;

const FOCUS_REASON_LABEL: Record<FocusReason, string> & Record<string, string> = {
  diagnosis_flagged: '系統重點提示',
  repeated_weakness: '連續多次偏弱',
  current_weakest:   '本次最弱項',
};

/** Converts planner's English trendNote to Chinese for display. */
export function fmtTrend(note: string): string {
  const m = note.match(/^Overall (up|down) ([\d.]+) vs last (\d+) sessions?$/);
  if (!m) return note;
  const dir = m[1] === 'up' ? '進步' : '退步';
  return `整體${dir} ${m[2]}（近 ${m[3]} 次平均）`;
}

// ── Component ─────────────────────────────────────────────────────────────────

type StudyPlanBlockProps = {
  plan: StudyPlan;
  dimLabel: Record<string, string>;
  taskLabel: Record<string, string>;
  accent: 'blue' | 'amber';
};

export function StudyPlanBlock({ plan, dimLabel, taskLabel, accent }: StudyPlanBlockProps) {
  const accentBorder    = accent === 'blue' ? 'border-l-blue-400'  : 'border-l-amber-400';
  const accentDimText   = accent === 'blue' ? 'text-blue-800'      : 'text-amber-800';
  const accentSub       = accent === 'blue' ? 'text-blue-500'      : 'text-amber-500';
  const taskBg          = accent === 'blue' ? 'bg-blue-50'         : 'bg-amber-50';
  const taskTitleCls    = accent === 'blue' ? 'text-blue-800'      : 'text-amber-800';
  const taskHintCls     = accent === 'blue' ? 'text-blue-500'      : 'text-amber-500';
  const firstSessionCls = accent === 'blue'
    ? 'border-blue-200 bg-blue-50 text-blue-600'
    : 'border-amber-200 bg-amber-50 text-amber-600';

  const statusCfg = (() => {
    if (!plan.progressStatus) return PROGRESS_STATUS_SHARED.stable;
    if (plan.progressStatus === 'first_session') return { label: '首次練習', cls: firstSessionCls };
    return PROGRESS_STATUS_SHARED[plan.progressStatus];
  })();

  const trendDisplay = plan.trendNote ? fmtTrend(plan.trendNote) : null;

  return (
    <div className="mt-4 border-t border-zinc-100 pt-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-500">學習計畫</span>
        <div className="flex items-center gap-1.5">
          {plan.sessionCount != null && (
            <span className="text-[10px] text-zinc-400">第 {plan.sessionCount + 1} 次</span>
          )}
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Current Focus */}
      {plan.currentFocus && (
        <div className={`rounded-r-lg border-l-2 bg-zinc-50 px-3 py-2 ${accentBorder}`}>
          <div className="text-[10px] text-zinc-400 mb-0.5">當前重點</div>
          <div className={`flex items-center gap-1.5 text-[13px] font-semibold ${accentDimText}`}>
            {dimLabel[plan.currentFocus.dimension] ?? plan.currentFocus.dimension}
            {plan.currentFocus.reason === 'repeated_weakness' && (
              <span className="rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                持續弱點
              </span>
            )}
          </div>
          <div className={`text-[10px] mt-0.5 ${accentSub}`}>
            {FOCUS_REASON_LABEL[plan.currentFocus.reason] ?? plan.currentFocus.reason}
          </div>
        </div>
      )}

      {/* Repeated Weaknesses */}
      {(plan.repeatedWeaknesses?.length ?? 0) > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] text-zinc-400">持續待改</div>
          <div className="flex flex-wrap gap-1">
            {(plan.repeatedWeaknesses ?? []).map((dim) => (
              <span key={dim} className="rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700">
                {dimLabel[dim] ?? dim}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress note */}
      {(trendDisplay ?? (plan.sessionCount === 0 ? '首次練習完成，持續練習後可追蹤進步趨勢。' : null)) && (
        <div className="text-[11px] italic text-zinc-500">
          {trendDisplay ?? '首次練習完成，持續練習後可追蹤進步趨勢。'}
        </div>
      )}

      {/* Recommended Next Practice */}
      <div>
        <div className="mb-1.5 text-[10px] text-zinc-400">推薦練習</div>
        <div className={`rounded-lg ${taskBg} px-2.5 py-2`}>
          <div className={`text-[12px] font-medium ${taskTitleCls}`}>
            {taskLabel[plan.nextTaskRecommendation] ?? plan.nextTaskRecommendation}
          </div>
          <div className={`text-[10px] mt-0.5 ${taskHintCls}`}>
            目標 Band {plan.milestoneBand}
          </div>
        </div>
      </div>

      {/* Practice Items */}
      {plan.practiceItems.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] text-zinc-400">練習要點</div>
          <ol className="space-y-1.5">
            {plan.practiceItems.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-zinc-700">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-medium text-zinc-500">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Reliability note */}
      {plan.reliabilityNote && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
          {plan.reliabilityNote}
        </div>
      )}

      <div className="text-right text-[10px] text-zinc-300">自動評估</div>
    </div>
  );
}
