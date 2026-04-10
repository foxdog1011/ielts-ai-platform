"use client";

import { useState } from "react";

type WritingBand = {
  overall?: number;
  taskResponse?: number;
  coherence?: number;
  lexical?: number;
  grammar?: number;
};

type SpeakingBand = {
  overall?: number;
  content?: number;
  grammar?: number;
  vocab?: number;
  fluency?: number;
  pronunciation?: number;
};

type SpeakingFeatures = Record<string, number | string | boolean | null | undefined>;

function fmtBand(n?: number) {
  if (n == null || Number.isNaN(n)) return "-";
  return Number(n).toFixed(1).replace(/\.0$/, "");
}

const CHIP_COLORS = ['#58CC02', '#1CB0F6', '#CE82FF', '#FFD900', '#FF4B4B'];

function Chip({ label, value, colorIdx = 0 }: { label: string; value?: number; colorIdx?: number }) {
  const color = CHIP_COLORS[colorIdx % CHIP_COLORS.length];
  return (
    <div className="flex items-center gap-1.5 rounded-xl border-2 border-zinc-200 bg-white px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_0_rgba(0,0,0,0.06)]">
      <span className="text-zinc-500">{label}</span>
      <span style={{ color }}>{fmtBand(value)}</span>
    </div>
  );
}

function Row({ k, v, unit }: { k: string; v?: number | string | boolean | null; unit?: string }) {
  const txt =
    v == null || (typeof v === "number" && !Number.isFinite(v))
      ? "-"
      : typeof v === "number"
      ? Number(v).toFixed(2).replace(/\.00$/, "")
      : String(v);
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="text-xs font-bold text-zinc-500">{k}</div>
      <div className="text-xs font-bold text-zinc-800">
        {txt}
        {unit ? <span className="ml-1 text-zinc-400">{unit}</span> : null}
      </div>
    </div>
  );
}

export function ScoreCardWriting({
  band,
  className,
}: {
  band: WritingBand;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border-2 border-zinc-200 bg-white p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]",
        className || "",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <div className="inline-block rounded-xl bg-[#1CB0F6] px-3 py-1 text-xs font-bold text-white">寫作</div>
        <div className="text-xs font-bold text-zinc-400">IELTS / 0.5 刻度</div>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div className="text-4xl font-bold tracking-tight text-[#1CB0F6]">
          {fmtBand(band.overall)}
        </div>
        <div className="text-sm font-bold text-zinc-400">/ 9</div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-[#1CB0F6]"
          style={{ width: `${Math.max(0, Math.min(100, ((band.overall ?? 0) / 9) * 100))}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip label="任務" value={band.taskResponse} colorIdx={0} />
        <Chip label="連貫" value={band.coherence} colorIdx={1} />
        <Chip label="詞彙" value={band.lexical} colorIdx={2} />
        <Chip label="文法" value={band.grammar} colorIdx={3} />
      </div>
    </div>
  );
}

export function ScoreCardSpeaking({
  band,
  features,
  className,
  defaultOpen = false,
}: {
  band: SpeakingBand;
  features?: SpeakingFeatures;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // 只挑面試會提到的重點特徵
  const keys: Array<[keyof SpeakingFeatures, string, string?]> = [
    ["wpm", "語速 (WPM)"],
    ["articulation_wpm", "去停頓語速"],
    ["pause_ratio", "停頓比例"],
    ["pause_count_ge300ms", "停頓次數(≥300ms)"],
    ["filler_per_100w", "填充詞 / 100 字"],
    ["self_repair_per_100w", "自我修正 / 100 字"],
    ["f0_std_hz", "音高波動 (Hz)"],
    ["energy_std", "能量波動"],
    ["duration_s", "語料長度", "s"],
    ["word_count", "字數"],
  ];

  return (
    <div
      className={[
        "rounded-3xl border-2 border-[#FFD900] bg-[#FFFDE7] p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]",
        className || "",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <div className="inline-block rounded-xl bg-[#FFD900] px-3 py-1 text-xs font-bold text-amber-900">口說</div>
        <div className="text-xs font-bold text-amber-500">IELTS / 0.5 刻度</div>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div className="text-4xl font-bold tracking-tight text-amber-800">
          {fmtBand(band.overall ?? band.content)}
        </div>
        <div className="text-sm font-bold text-amber-500">/ 9</div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-amber-200/50">
        <div
          className="h-full rounded-full bg-[#FFD900]"
          style={{ width: `${Math.max(0, Math.min(100, (((band.overall ?? band.content) ?? 0) / 9) * 100))}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip label="內容" value={band.content} colorIdx={0} />
        <Chip label="文法" value={band.grammar} colorIdx={1} />
        <Chip label="詞彙" value={band.vocab} colorIdx={2} />
        <Chip label="流暢度" value={band.fluency} colorIdx={3} />
        <Chip label="發音" value={band.pronunciation} colorIdx={4} />
      </div>

      <button
        className="mt-4 rounded-xl border-2 border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 shadow-[2px_2px_0_0_rgba(0,0,0,0.06)] transition-all"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? "收起詳細特徵" : "展開詳細特徵"}
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border-2 border-amber-200 bg-white p-4">
          {keys.map(([k, label, unit]) => (
            <Row key={String(k)} k={label} v={features?.[k]} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}
