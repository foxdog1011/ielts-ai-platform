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

function Chip({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white/80 px-2 py-1 text-[12px] text-zinc-700">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium">{fmtBand(value)}</span>
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
    <div className="flex items-center justify-between py-1">
      <div className="text-[12px] text-zinc-500">{k}</div>
      <div className="text-[12px] text-zinc-800">
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
        "rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur",
        className || "",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] text-zinc-500">Writing</div>
        <div className="text-[11px] text-zinc-400">IELTS / 0.5 刻度</div>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="text-[28px] font-semibold tracking-tight">
          {fmtBand(band.overall)}
        </div>
        <div className="text-[12px] text-zinc-500">/ 9</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip label="Task" value={band.taskResponse} />
        <Chip label="Coherence" value={band.coherence} />
        <Chip label="Lexical" value={band.lexical} />
        <Chip label="Grammar" value={band.grammar} />
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
    ["filler_per_100w", "Filler / 100 words"],
    ["self_repair_per_100w", "Self-repair / 100 words"],
    ["f0_std_hz", "音高波動 (Hz)"],
    ["energy_std", "能量波動"],
    ["duration_s", "語料長度", "s"],
    ["word_count", "字數"],
  ];

  return (
    <div
      className={[
        "rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm backdrop-blur",
        className || "",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] text-amber-700">Speaking</div>
        <div className="text-[11px] text-amber-500">IELTS / 0.5 刻度</div>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="text-[28px] font-semibold tracking-tight text-amber-900">
          {fmtBand(band.overall ?? band.content)}
        </div>
        <div className="text-[12px] text-amber-700">/ 9</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip label="Content" value={band.content} />
        <Chip label="Grammar" value={band.grammar} />
        <Chip label="Vocab" value={band.vocab} />
        <Chip label="Fluency" value={band.fluency} />
        <Chip label="Pronunciation" value={band.pronunciation} />
      </div>

      <button
        className="mt-3 text-[12px] text-amber-700 hover:underline"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? "收起詳細特徵" : "展開詳細特徵"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-white/70 p-3">
          {keys.map(([k, label, unit]) => (
            <Row key={String(k)} k={label} v={features?.[k]} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}
