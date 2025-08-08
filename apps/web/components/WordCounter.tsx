import React from 'react';

export default function WordCounter({ text, target=250 }: { text: string; target?: number }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const pct = Math.min(100, Math.round((words / target) * 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Words: {words}/{target}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
