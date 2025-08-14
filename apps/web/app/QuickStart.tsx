'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function QuickStart() {
  const [loadingW, setLoadingW] = useState(false);
  const [loadingS, setLoadingS] = useState(false);
  const router = useRouter();

  async function goRandom(type: "writing" | "speaking") {
    try {
      type === "writing" ? setLoadingW(true) : setLoadingS(true);
      const res = await fetch(`/api/prompts/random?type=${type}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "No prompt available");
      const q = encodeURIComponent(json.data.prompt || "");
      if (type === "writing") router.push(`/tasks/1/writing?q=${q}`);
      else router.push(`/tasks/1/speaking?q=${q}`);
    } catch (e: any) {
      alert(e?.message || "Failed to fetch a prompt");
    } finally {
      setLoadingW(false); setLoadingS(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        onClick={() => goRandom("writing")}
        disabled={loadingW}
        className={[
          "rounded-xl border px-4 py-2 text-sm",
          loadingW ? "cursor-wait border-zinc-200 bg-zinc-100 text-zinc-400"
                   : "border-zinc-300 bg-white hover:bg-zinc-50"
        ].join(" ")}
      >
        {loadingW ? "抽題中…" : "隨機一題（Writing）"}
      </button>
      <button
        onClick={() => goRandom("speaking")}
        disabled={loadingS}
        className={[
          "rounded-xl border px-4 py-2 text-sm",
          loadingS ? "cursor-wait border-amber-200 bg-amber-50/60 text-amber-400"
                   : "border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
        ].join(" ")}
      >
        {loadingS ? "抽題中…" : "隨機一題（Speaking）"}
      </button>
    </div>
  );
}
