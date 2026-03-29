// components/LearningCalendar.tsx
// GitHub-style contribution calendar (last 7 weeks) + streak counter.
// Server component — receives pre-fetched history.

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
  // Build a map: dateKey → { writing, speaking }
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

  // Build last 7 weeks (49 days), starting from 48 days ago
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const days: { key: string; w: number; s: number; isToday: boolean }[] = [];
  for (let i = 48; i >= 0; i--) {
    const d = new Date(todayMs - i * 86400_000);
    const key = toDateKey(d.getTime());
    const entry = dayMap.get(key) ?? { w: 0, s: 0 };
    days.push({ key, ...entry, isToday: i === 0 });
  }

  // Calculate streak (consecutive days ending today with at least 1 session)
  let streak = 0;
  for (let i = 0; i <= 48; i++) {
    const d = new Date(todayMs - i * 86400_000);
    const key = toDateKey(d.getTime());
    const entry = dayMap.get(key);
    if (entry && (entry.w + entry.s) > 0) {
      streak++;
    } else {
      break;
    }
  }

  // Fill to full 7x7 grid (pad front with empty slots)
  const padCount = 49 - days.length;
  const grid = [...Array(padCount).fill(null), ...days];

  function cellColor(d: typeof days[0] | null): string {
    if (!d) return 'bg-transparent';
    const total = d.w + d.s;
    if (total === 0) return 'bg-zinc-100';
    if (d.w > 0 && d.s > 0) return 'bg-purple-400';
    if (d.w > 0) return 'bg-blue-400';
    return 'bg-amber-400';
  }

  const weeks: (typeof days[0] | null)[][] = [];
  for (let col = 0; col < 7; col++) {
    weeks.push(grid.slice(col * 7, col * 7 + 7));
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-zinc-700">學習足跡</span>
        {streak > 0 && (
          <span className="text-[12px] font-semibold text-orange-600">
            🔥 {streak} 天連續
          </span>
        )}
      </div>

      {/* Grid: 7 columns × 7 rows */}
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={di}
                title={day ? `${day.key}${day.w + day.s > 0 ? ` · W:${day.w} S:${day.s}` : ''}` : ''}
                className={[
                  'h-3 w-3 rounded-sm transition-colors',
                  cellColor(day),
                  day?.isToday ? 'ring-1 ring-zinc-400' : '',
                ].join(' ')}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400 inline-block" /> Writing</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400 inline-block" /> Speaking</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-purple-400 inline-block" /> 兩者</span>
      </div>
    </div>
  );
}
