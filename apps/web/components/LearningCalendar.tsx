// components/LearningCalendar.tsx
// Comprehensive learning footprint: stats + 16-week contribution calendar + streak.

import type { HistoryRecord } from '@/lib/history';

type Props = { history: HistoryRecord[] };

function toDateKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recToMs(rec: HistoryRecord): number {
  if (typeof (rec as any).ts === 'number') return (rec as any).ts;
  if (rec.createdAt) return Date.parse(rec.createdAt);
  return 0;
}

export function LearningCalendar({ history }: Props) {
  // Build day map
  const dayMap = new Map<string, { w: number; s: number }>();
  for (const rec of history) {
    const ms = recToMs(rec);
    if (!ms) continue;
    const key = toDateKey(ms);
    const entry = dayMap.get(key) ?? { w: 0, s: 0 };
    if (rec.type === 'writing') entry.w++;
    else entry.s++;
    dayMap.set(key, entry);
  }

  // Today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  // 16 weeks = 112 days
  const DAYS = 112;
  const days: { key: string; w: number; s: number; isToday: boolean }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(todayMs - i * 86400_000);
    const key = toDateKey(d.getTime());
    const entry = dayMap.get(key) ?? { w: 0, s: 0 };
    days.push({ key, ...entry, isToday: i === 0 });
  }

  // Streak (consecutive days ending today)
  let streak = 0;
  for (let i = 0; i <= DAYS; i++) {
    const d = new Date(todayMs - i * 86400_000);
    const key = toDateKey(d.getTime());
    const entry = dayMap.get(key);
    if (entry && (entry.w + entry.s) > 0) streak++;
    else break;
  }

  // Active days this month
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  let activeDaysThisMonth = 0;
  for (const [key, entry] of dayMap) {
    if (key.startsWith(thisMonthKey) && (entry.w + entry.s) > 0) activeDaysThisMonth++;
  }

  // Totals from all history passed in
  const totalWriting = history.filter((r) => r.type === 'writing').length;
  const totalSpeaking = history.filter((r) => r.type === 'speaking').length;
  const totalSessions = history.length;

  // Active days total (unique days with at least one session)
  const activeDays = dayMap.size;

  // Pad grid to 16×7
  const padCount = 16 * 7 - days.length;
  const grid = [...Array(padCount).fill(null), ...days];

  // Split into 16 columns of 7
  const weeks: (typeof days[0] | null)[][] = [];
  for (let col = 0; col < 16; col++) {
    weeks.push(grid.slice(col * 7, col * 7 + 7));
  }

  function cellColor(d: typeof days[0] | null): string {
    if (!d) return 'bg-transparent';
    const total = d.w + d.s;
    if (total === 0) return 'bg-zinc-200/70';
    if (d.w > 0 && d.s > 0) return 'bg-violet-400';
    if (d.w > 0) return total >= 2 ? 'bg-blue-500' : 'bg-blue-300';
    return total >= 2 ? 'bg-amber-500' : 'bg-amber-300';
  }

  // Month labels: find the first day of each month in the grid
  const monthLabels: { col: number; label: string }[] = [];
  for (let col = 0; col < 16; col++) {
    const firstDayInCol = weeks[col].find((d) => d !== null);
    if (firstDayInCol) {
      const d = new Date(firstDayInCol.key);
      if (d.getDate() <= 7) {
        monthLabels.push({
          col,
          label: d.toLocaleDateString('zh-TW', { month: 'short' }),
        });
      }
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-800">學習足跡</h3>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1">
            <span className="text-[13px]">🔥</span>
            <span className="text-[12px] font-semibold text-orange-700">{streak} 天連續</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <StatBox label="總練習次數" value={String(totalSessions)} sub="sessions" />
        <StatBox label="本月活躍天" value={String(activeDaysThisMonth)} sub="days" accent />
        <StatBox label="Writing" value={String(totalWriting)} sub={`of ${totalSessions}`} blue />
        <StatBox label="Speaking" value={String(totalSpeaking)} sub={`of ${totalSessions}`} amber />
      </div>

      {/* Calendar grid: 16 cols x 7 rows — scrollable on mobile */}
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        {/* Month labels */}
        <div className="flex gap-1 mb-0.5 pl-0 min-w-max">
          {weeks.map((_, wi) => {
            const label = monthLabels.find((m) => m.col === wi);
            return (
              <div key={wi} className="w-4 shrink-0 text-[9px] text-zinc-400 font-medium leading-none truncate">
                {label?.label ?? ''}
              </div>
            );
          })}
        </div>

        <div className="flex gap-1 min-w-max">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 shrink-0">
              {week.map((day, di) => (
                <div
                  key={di}
                  title={day ? `${day.key}${day.w + day.s > 0 ? ` · W:${day.w} S:${day.s}` : ''}` : ''}
                  className={[
                    'h-4 w-4 rounded-sm transition-colors',
                    cellColor(day),
                    day?.isToday ? 'ring-2 ring-zinc-500 ring-offset-1' : '',
                  ].join(' ')}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-blue-400 inline-block" />
          Writing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-amber-400 inline-block" />
          Speaking
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-violet-400 inline-block" />
          兩者
        </span>
        <span className="ml-auto text-zinc-300">過去 16 週</span>
      </div>
    </div>
  );
}

function StatBox({
  label, value, sub, accent, blue, amber,
}: {
  label: string; value: string; sub: string;
  accent?: boolean; blue?: boolean; amber?: boolean;
}) {
  const bg = blue
    ? 'bg-blue-50 border-blue-100'
    : amber
    ? 'bg-amber-50 border-amber-100'
    : accent
    ? 'bg-emerald-50 border-emerald-100'
    : 'bg-zinc-50 border-zinc-200';
  const valueColor = blue
    ? 'text-blue-700'
    : amber
    ? 'text-amber-700'
    : accent
    ? 'text-emerald-700'
    : 'text-zinc-900';

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${bg}`}>
      <div className={`text-[20px] font-bold leading-none ${valueColor}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium text-zinc-500">{label}</div>
      <div className="text-[10px] text-zinc-400">{sub}</div>
    </div>
  );
}
