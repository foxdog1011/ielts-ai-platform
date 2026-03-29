'use client';
// components/InlineEssay.tsx
// Renders an essay with clickable paragraph highlights linked to AI feedback.

import { useState } from 'react';

export type ParagraphFeedback = { index: number; comment: string };

type Props = {
  text: string;
  feedback?: ParagraphFeedback[];
};

export function InlineEssay({ text, feedback = [] }: Props) {
  const [active, setActive] = useState<number | null>(null);

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const feedbackMap = new Map(feedback.map((f) => [f.index, f.comment]));

  if (!paragraphs.length) {
    return (
      <div className="min-h-[120px] rounded-xl border border-zinc-200 bg-white p-3 text-[13px] text-zinc-400">
        （尚未輸入）
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => {
        const comment = feedbackMap.get(i);
        const isActive = active === i;
        const hasComment = !!comment;

        return (
          <div key={i}>
            <div
              onClick={() => hasComment && setActive(isActive ? null : i)}
              className={[
                'rounded-xl border p-3 text-[13px] leading-relaxed transition-colors',
                hasComment
                  ? isActive
                    ? 'cursor-pointer border-amber-300 bg-amber-50/80 text-zinc-800'
                    : 'cursor-pointer border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 text-zinc-800'
                  : 'border-zinc-200 bg-white text-zinc-800',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                <span
                  className={[
                    'mt-0.5 shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                    hasComment
                      ? 'border border-amber-300 bg-amber-100 text-amber-700'
                      : 'border border-zinc-200 bg-zinc-50 text-zinc-400',
                  ].join(' ')}
                >
                  {i + 1}
                </span>
                <span className="whitespace-pre-wrap flex-1">{para}</span>
                {hasComment && (
                  <span className="shrink-0 text-[10px] text-amber-600 mt-0.5">
                    {isActive ? '▲' : '▼'}
                  </span>
                )}
              </div>
            </div>

            {isActive && comment && (
              <div className="mt-1 ml-7 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                <span className="font-medium">AI 批注：</span> {comment}
              </div>
            )}
          </div>
        );
      })}

      {feedback.length > 0 && (
        <div className="text-[11px] text-zinc-400 pl-1">
          點擊標色段落查看 AI 批注（共 {feedback.length} 條）
        </div>
      )}
    </div>
  );
}
