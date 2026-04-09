'use client';
// apps/web/app/notebook/page.tsx

import Link from "next/link";
import { useEffect, useState } from "react";

type NotebookEntry = {
  id: string;
  ts: number;
  examType: "writing" | "speaking";
  dimension: string;
  original: string;
  correction: string;
  explanation: string;
};

export default function NotebookPage() {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "writing" | "speaking">("all");

  useEffect(() => {
    fetch("/api/notebook")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setEntries(j.data); })
      .finally(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    await fetch(`/api/notebook?id=${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const visible = filter === "all" ? entries : entries.filter((e) => e.examType === filter);

  return (
    <main className="min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[14px] sm:text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors min-h-[44px] flex items-center">← 回首頁</Link>
            <h1 className="text-[18px] font-semibold tracking-tight">錯題本</h1>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[12px] sm:text-[11px] text-zinc-500">{entries.length} 條</span>
          </div>
          <div className="flex items-center gap-1.5">
            {(["all", "writing", "speaking"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={[
                  "rounded-xl border px-3 py-2 sm:py-1.5 min-h-[44px] text-[13px] sm:text-[12px] font-medium transition-colors",
                  filter === t
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white hover:bg-zinc-50",
                ].join(" ")}
              >
                {t === "all" ? "全部" : t === "writing" ? "Writing" : "Speaking"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 space-y-3">
        {loading && (
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-100" />)}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-8 text-center shadow-sm">
            <div className="text-[32px] mb-3">📒</div>
            <div className="text-[15px] text-zinc-600">尚無錯題紀錄</div>
            <p className="mt-2 text-[13px] text-zinc-400">
              在 Writing 評分後，點擊改善建議旁的 <kbd className="rounded border border-zinc-200 px-1 text-[11px]">+</kbd> 即可加入。
            </p>
          </div>
        )}

        {visible.map((entry) => (
          <NotebookCard key={entry.id} entry={entry} onDelete={remove} />
        ))}
      </section>
    </main>
  );
}

function NotebookCard({ entry, onDelete }: { entry: NotebookEntry; onDelete: (id: string) => void }) {
  const isWriting = entry.examType === "writing";
  const date = new Date(entry.ts).toLocaleDateString("zh-TW", { month: "short", day: "numeric" });

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={[
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
            isWriting ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700",
          ].join(" ")}>
            {isWriting ? "W" : "S"}
          </span>
          <span className="text-[11px] text-zinc-400">{date}</span>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="w-11 h-11 sm:w-auto sm:h-auto flex items-center justify-center text-[14px] sm:text-[11px] text-zinc-400 hover:text-red-500 transition-colors shrink-0"
          title="刪除"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 text-[14px] sm:text-[13px] leading-relaxed text-zinc-800">
        {entry.explanation}
      </div>
    </div>
  );
}
