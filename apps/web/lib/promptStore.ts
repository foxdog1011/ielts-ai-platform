// apps/web/lib/promptStore.ts
import { unstable_noStore as noStore } from "next/cache";
import {
  kvListPushJSON,
  kvListTailJSON,
  kvSetAdd,
  kvSetHas,
} from "@/lib/kv";
import fs from "node:fs/promises";
import path from "node:path";

/** 題型 / 分項型別 */
export type PromptType = "writing" | "speaking";
export type WritingPart = "task1-ac" | "task1-gt" | "task2";
export type SpeakingPart = "part1" | "part2" | "part3";
export type PromptLevel = "5.0-6.0" | "6.0-7.0" | "7.0-8.0";

/** 完整題目型別（存入 KV 後） */
export type PromptItem = {
  id: string;
  hash: string;
  ts: number;
  type: PromptType;
  part: WritingPart | SpeakingPart;
  level?: PromptLevel;
  prompt: string;
  topicTags: string[];
  followup?: string[];
  source: "seed" | "ai-gen" | "manual";
};

/** API/生成 給的是「半成品」 */
export type PromptDraft = Omit<PromptItem, "id" | "hash" | "ts">;

/* -------------------- Keys -------------------- */
const LIST_KEY = (type: PromptType, part: WritingPart | SpeakingPart) =>
  `prompts:v1:${type}:${part}`;
const HASH_SET_KEY = `prompts:v1:hashes`;

/* -------------------- Utils -------------------- */
function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function hashPrompt(input: { type: PromptType; part: string; prompt: string }): string {
  const s = `${input.type}|${input.part}|${input.prompt.trim()}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return `h${(h >>> 0).toString(36)}`;
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => String(t || "").trim().toLowerCase()).filter(Boolean).slice(0, 4);
}

/* -------------------- Save / List -------------------- */

export async function savePromptsUniq(drafts: PromptDraft[]): Promise<PromptItem[]> {
  noStore();
  const saved: PromptItem[] = [];

  for (const d of drafts) {
    const prompt = String(d.prompt || "").trim();
    if (prompt.length < 10) continue;

    const type = d.type;
    const part = d.part as WritingPart | SpeakingPart;

    const item: PromptItem = {
      id: makeId(),
      hash: hashPrompt({ type, part, prompt }),
      ts: Date.now(),
      type,
      part,
      level: d.level,
      prompt,
      topicTags: normalizeTags(d.topicTags),
      followup: Array.isArray(d.followup)
        ? d.followup.map((q) => String(q || "").trim()).filter(Boolean).slice(0, 6)
        : undefined,
      source: d.source ?? "ai-gen",
    };

    const dup = await kvSetHas(HASH_SET_KEY, item.hash);
    if (dup) continue;

    await kvListPushJSON(LIST_KEY(type, part), item);
    await kvSetAdd(HASH_SET_KEY, item.hash);
    saved.push(item);
  }
  return saved;
}

export async function listPrompts(opts: {
  type?: PromptType;
  part?: WritingPart | SpeakingPart;
  topic?: string;
  level?: PromptLevel;
  limit?: number;
  offset?: number;
}): Promise<PromptItem[]> {
  noStore();
  const { type, part, topic, level, limit = 50, offset = 0 } = opts;

  const TAKE_CAP = Math.max(50, limit + offset);
  let rows: PromptItem[] = [];

  if (type && part) {
    rows = await kvListTailJSON<PromptItem>(LIST_KEY(type, part), TAKE_CAP);
  } else {
    const writingParts: WritingPart[] = ["task1-ac", "task1-gt", "task2"];
    const speakingParts: SpeakingPart[] = ["part1", "part2", "part3"];
    const keys: string[] = [];

    if (!type || type === "writing") {
      for (const p of writingParts) if (!part || part === p) keys.push(LIST_KEY("writing", p));
    }
    if (!type || type === "speaking") {
      for (const p of speakingParts) if (!part || part === p) keys.push(LIST_KEY("speaking", p));
    }

    const chunks = await Promise.all(keys.map((k) => kvListTailJSON<PromptItem>(k, TAKE_CAP)));
    rows = chunks.flat();
  }

  rows = [...rows].reverse(); // 新→舊
  const t = String(topic || "").trim().toLowerCase();

  const filtered = rows.filter((x) => {
    if (level && x.level !== level) return false;
    if (t && !x.topicTags?.some((tg) => tg.includes(t))) return false;
    return true;
  });

  return filtered.slice(offset, offset + limit);
}

export async function pickRandomPrompt(opts: {
  type?: PromptType;
  part?: WritingPart | SpeakingPart;
  topic?: string;
  level?: PromptLevel;
}): Promise<PromptItem | null> {
  const cands = await listPrompts({ ...opts, limit: 200, offset: 0 });
  if (!cands.length) return null;
  return cands[Math.floor(Math.random() * cands.length)];
}

/* -------------------- Seeds -------------------- */

const SEED_PROMPTS: PromptDraft[] = [
  // Writing Task 2
  {
    type: "writing",
    part: "task2",
    level: "6.0-7.0",
    prompt:
      "Some people believe that technology has made students less focused, while others think it has improved their learning efficiency. Discuss both views and give your own opinion.",
    topicTags: ["education", "technology"],
    source: "seed",
  },
  {
    type: "writing",
    part: "task2",
    level: "6.0-7.0",
    prompt:
      "Many governments are investing in public transport to reduce traffic and pollution. To what extent do you agree or disagree?",
    topicTags: ["environment", "government"],
    source: "seed",
  },
  // Speaking Part 2
  {
    type: "speaking",
    part: "part2",
    level: "6.0-7.0",
    prompt:
      "Describe a person who has inspired you. You should say:\n- who the person is\n- how you know this person\n- what this person did\nand explain why this person inspired you.",
    topicTags: ["person", "inspiration"],
    followup: [
      "Do you think role models are necessary for young people?",
      "Can public figures influence social values?",
    ],
    source: "seed",
  },
  {
    type: "speaking",
    part: "part2",
    level: "6.0-7.0",
    prompt:
      "Describe a place you visited that left a strong impression on you. You should say:\n- where it is\n- when you went there\n- what you did there\nand explain why it was memorable.",
    topicTags: ["place", "travel"],
    followup: [
      "Do you prefer traveling alone or with others?",
      "How has tourism changed in your country in recent years?",
    ],
    source: "seed",
  },
];

/** 嘗試從 public/prompts/*.json 讀檔種子；若無檔案就用內建 SEED_PROMPTS */
export async function seedFromFiles(): Promise<PromptItem[]> {
  noStore();

  const drafts: PromptDraft[] = [];
  const tries: Array<{ file: string; type: PromptType; part: WritingPart | SpeakingPart }> = [
    { file: "writing_task2.json", type: "writing", part: "task2" },
    { file: "speaking_part2.json", type: "speaking", part: "part2" },
  ];

  for (const t of tries) {
    const p = path.join(process.cwd(), "public", "prompts", t.file);
    try {
      const buf = await fs.readFile(p, "utf8");
      const json = JSON.parse(buf);
      const arr = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
      for (const raw of arr) {
        drafts.push({
          type: t.type,
          part: t.part,
          prompt: String(raw?.prompt || "").trim(),
          topicTags: normalizeTags(raw?.topicTags),
          followup: Array.isArray(raw?.followup)
            ? raw.followup.map((q: any) => String(q || "").trim()).filter(Boolean).slice(0, 6)
            : undefined,
          level: (["5.0-6.0", "6.0-7.0", "7.0-8.0"] as PromptLevel[]).includes(raw?.level)
            ? (raw.level as PromptLevel)
            : undefined,
          source: "seed",
        });
      }
    } catch {
      // 檔案不存在或壞掉就忽略
    }
  }

  // 若沒讀到任何檔案，就用內建 SEED_PROMPTS
  const toSave = drafts.length ? drafts : SEED_PROMPTS;
  if (!toSave.length) return [];

  const saved = await savePromptsUniq(toSave);
  return saved;
}
