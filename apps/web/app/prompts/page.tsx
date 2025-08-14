'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type PromptFlags = { fav?: boolean; skip?: boolean; usedCount?: number; lastUsedTs?: number; };
type PromptRow = {
  id: string;
  type: "writing" | "speaking";
  part: string;
  topicTags: string[];
  level?: string;
  prompt: string;
  followup?: string[];
  ts: number;
  flags?: PromptFlags;
};

export default function PromptBankPage() {
  // ---- 產生器狀態 ----
  const [type, setType] = useState<"writing" | "speaking">("writing");
  const [part, setPart] = useState<string>("task2");
  const [count, setCount] = useState<number>(10);
  const [topics, setTopics] = useState<string>("education, technology");
  const [level, setLevel] = useState<string>("6.0-7.0");
  const [loadingGen, setLoadingGen] = useState(false);

  // ---- 查詢狀態（同步到 URL）----
  const router = useRouter();
  const urlParams = useSearchParams();

  const [qType, setQType] = useState<string>(urlParams.get("type") || "");
  const [qPart, setQPart] = useState<string>(urlParams.get("part") || "");
  const [qTopic, setQTopic] = useState<string>(urlParams.get("topic") || "");
  const [favOnly, setFavOnly] = useState<boolean>(["1","true","yes"].includes((urlParams.get("favOnly")||"")));
  const [hideSkipped, setHideSkipped] = useState<boolean>(["1","true","yes"].includes((urlParams.get("hideSkipped")||"")));
  const [offset, setOffset] = useState<number>(Number(urlParams.get("offset") || 0));

  const [rows, setRows] = useState<PromptRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // URL 同步
  useEffect(() => {
    const p = new URLSearchParams();
    if (qType) p.set("type", qType);
    if (qPart) p.set("part", qPart);
    if (qTopic) p.set("topic", qTopic);
    if (favOnly) p.set("favOnly", "1");
    if (hideSkipped) p.set("hideSkipped", "1");
    if (offset) p.set("offset", String(offset));
    const qs = p.toString();
    router.replace(qs ? `/prompts?${qs}` : "/prompts");
  }, [qType, qPart, qTopic, favOnly, hideSkipped, offset, router]);

  // ---- 拉題庫列表 ----
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [qType, qPart, qTopic, favOnly, hideSkipped, offset]);

  async function fetchList() {
    try {
      setIsLoading(true);
      setErr("");
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const params = new URLSearchParams();
      if (qType) params.set("type", qType);
      if (qPart) params.set("part", qPart);
      if (qTopic) params.set("topic", qTopic);
      if (favOnly) params.set("favOnly", "1");
      if (hideSkipped) params.set("hideSkipped", "1");
      params.set("limit", "50");
      params.set("offset", String(offset));

      const res = await fetch(`/api/prompts/list?${params.toString()}`, { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRows(json.data || []);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(e?.message || "載入失敗，稍後再試");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  // ---- 批次產生 ----
  async function generate() {
    setLoadingGen(true);
    try {
      const payload = {
        type,
        part,
        count,
        topics: topics.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
        level: level as any,
      };
      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "生成失敗");
      setOffset(0);
      await fetchList();
    } catch (e: any) {
      alert(e?.message || "Unknown error");
    } finally {
      setLoadingGen(false);
    }
  }

  // ---- 切換收藏/略過（樂觀更新）----
  async function toggleFlag(id: string, flag: "fav" | "skip") {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, flags: { ...r.flags, [flag]: !r.flags?.[flag] } } : r))
    );
    try {
      const res = await fetch("/api/prompts/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, flag }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "flag 更新失敗");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, flags: json.data } : r)));
    } catch (e) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, flags: { ...r.flags, [flag]: !r.flags?.[flag] } } : r))
      );
      alert((e as any)?.message || "無法更新旗標");
    }
  }

  const canLoadMore = useMemo(() => rows.length >= 50, [rows.length]);

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] text-zinc-500 hover:text-zinc-800">← 回首頁</Link>
            <h1 className="text-[18px] font-medium tracking-tight">題庫（Prompt Bank）</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/tasks/1/writing" className="text-[12px] text-zinc-500 hover:text-zinc-800">去練習 →</Link>
            <button
              className="text-[12px] text-zinc-500 hover:text-zinc-800"
              onClick={() => { setQType(""); setQPart(""); setQTopic(""); setFavOnly(false); setHideSkipped(false); setOffset(0); }}
            >
              清除篩選
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12 space-y-8">
        {/* 生成器 */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
          <div className="text-[14px] font-medium">批次生成</div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {/* 題型/Part */}
            <div className="rounded-xl border border-zinc-200 bg-white/60 p-3">
              <div className="text-[12px] text-zinc-500">題型</div>
              <div className="mt-1 flex gap-2">
                <select className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px]" value={type} onChange={(e)=> {
                  const t = e.target.value as "writing"|"speaking"; setType(t);
                  setPart(t === "writing" ? "task2" : "part2");
                }}>
                  <option value="writing">Writing</option>
                  <option value="speaking">Speaking</option>
                </select>
                <select className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px]" value={part} onChange={(e)=> setPart(e.target.value)}>
                  {type === "writing" ? (
                    <>
                      <option value="task2">Task 2</option>
                      <option value="task1-ac">Task 1 Academic</option>
                      <option value="task1-gt">Task 1 General</option>
                    </>
                  ) : (
                    <>
                      <option value="part1">Part 1</option>
                      <option value="part2">Part 2 (Cue Card)</option>
                      <option value="part3">Part 3</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* 主題/難度 */}
            <div className="rounded-xl border border-zinc-200 bg-white/60 p-3">
              <div className="text-[12px] text-zinc-500">主題 & 難度</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input className="w-56 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px]"
                  placeholder="education, technology, environment"
                  value={topics} onChange={(e)=> setTopics(e.target.value)} />
                <select className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px]" value={level} onChange={(e)=> setLevel(e.target.value)}>
                  <option>5.0-6.0</option>
                  <option>6.0-7.0</option>
                  <option>7.0-8.0</option>
                </select>
              </div>
            </div>

            {/* 數量/提交 */}
            <div className="rounded-xl border border-zinc-200 bg-white/60 p-3">
              <div className="text-[12px] text-zinc-500">數量</div>
              <div className="mt-1 flex items-center gap-2">
                <input type="range" min={5} max={50} step={5} value={count} onChange={(e)=> setCount(Number(e.target.value))} className="w-48 accent-zinc-700" />
                <span className="text-[12px] text-zinc-700">{count}</span>
                <button onClick={generate} disabled={loadingGen}
                  className={["ml-auto rounded-xl border px-3 py-1.5 text-[12px]",
                    loadingGen ? "cursor-wait border-zinc-200 bg-zinc-100 text-zinc-400"
                               : "border-zinc-300 bg-white hover:bg-zinc-50"].join(" ")}>
                  {loadingGen ? "生成中…" : "開始生成"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 查詢區 */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-medium">題庫</div>
            <div className="flex items-center gap-2 text-[12px]">
              <select className="rounded-lg border border-zinc-300 bg-white px-2 py-1" value={qType} onChange={(e)=> { setOffset(0); setQType(e.target.value); }}>
                <option value="">全部類型</option>
                <option value="writing">Writing</option>
                <option value="speaking">Speaking</option>
              </select>
              <input className="w-40 rounded-lg border border-zinc-300 bg-white px-2 py-1" placeholder="part (task2/part2…)" value={qPart} onChange={(e)=> { setOffset(0); setQPart(e.target.value); }} />
              <input className="w-40 rounded-lg border border-zinc-300 bg-white px-2 py-1" placeholder="topic 關鍵字" value={qTopic} onChange={(e)=> { setOffset(0); setQTopic(e.target.value); }} />

              {/* flags 篩選 */}
              <label className="ml-2 inline-flex items-center gap-1">
                <input type="checkbox" checked={favOnly} onChange={(e)=> { setOffset(0); setFavOnly(e.target.checked); }} />
                <span>只看收藏</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={hideSkipped} onChange={(e)=> { setOffset(0); setHideSkipped(e.target.checked); }} />
                <span>隱藏略過</span>
              </label>

              <button onClick={()=> { setOffset((o)=> o + 50); }} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 disabled:opacity-50" disabled={!canLoadMore || isLoading} title={canLoadMore ? "載入更多" : "已到列表尾端"}>
                載入更多
              </button>
            </div>
          </div>

          {/* 狀態列 */}
          <div className="mt-2 text-[12px] text-zinc-500">
            {isLoading ? "載入中…" : err ? <span className="text-red-600">{err}</span> : rows.length ? `顯示 ${rows.length} 筆` : "目前沒有符合條件的資料"}
          </div>

          {/* 骨架或列表 */}
          {isLoading ? (
            <div className="mt-4 grid gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl border border-zinc-200 bg-white/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-zinc-500">
                      <span className="mr-2 rounded border border-zinc-200 bg-white px-1.5 py-0.5">{r.type}</span>
                      <span className="mr-2 rounded border border-zinc-200 bg-white px-1.5 py-0.5">{r.part}</span>
                      {r.level && <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5">Level {r.level}</span>}
                    </div>
                    <div className="text-[11px] text-zinc-500">{fmtTime(r.ts)}</div>
                  </div>

                  <div className="mt-2 text-[14px] leading-relaxed text-zinc-800 whitespace-pre-wrap">{r.prompt}</div>
                  {!!r.followup?.length && (
                    <ul className="mt-2 list-disc pl-5 text-[13px] leading-relaxed text-zinc-700">
                      {r.followup.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {(r.topicTags || []).map((t) => (
                        <span key={t} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">#{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={()=> copy(r.prompt)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px] hover:bg-zinc-50">複製題目</button>
                      <button onClick={()=> toggleFlag(r.id, "fav")} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px] hover:bg-zinc-50">
                        {r.flags?.fav ? "★ 已收藏" : "☆ 收藏"}
                      </button>
                      <button onClick={()=> toggleFlag(r.id, "skip")} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px] hover:bg-zinc-50">
                        {r.flags?.skip ? "已略過" : "略過"}
                      </button>
                      {r.type === "writing" ? (
                        <Link href={`/tasks/1/writing?q=${encodeURIComponent(r.prompt)}`} className="rounded-lg border border-blue-300 bg-blue-50 px-2 py-1 text-[12px] text-blue-900 hover:bg-blue-100">用此練習</Link>
                      ) : (
                        <Link href={`/tasks/1/speaking?q=${encodeURIComponent(r.prompt)}`} className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[12px] text-amber-900 hover:bg-amber-100">用此練習</Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {rows.length === 0 && !err && <div className="text-[13px] text-zinc-500">尚無資料，先在上方生成一些吧！</div>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function copy(s: string) {
  try { navigator.clipboard?.writeText?.(s); } catch {}
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
