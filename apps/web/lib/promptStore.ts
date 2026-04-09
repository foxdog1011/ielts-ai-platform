// apps/web/lib/promptStore.ts
import { unstable_noStore as noStore } from "next/cache";
import {
  kvGetJSON,
  kvListPushJSON,
  kvListTailJSON,
  kvSetAdd,
  kvSetJSON,
  kvSetHas,
} from "@/lib/kv";
import fs from "node:fs/promises";
import path from "node:path";

/** Usage stats persisted per prompt. */
export type PromptUsage = {
  usedCount: number;
  lastUsedTs: number;
};

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
export type PromptFlags = {
  fav?: boolean;
  skip?: boolean;
};
export type PromptItemWithFlags = PromptItem & { flags?: PromptFlags };

/* -------------------- Keys -------------------- */
const LIST_KEY = (type: PromptType, part: WritingPart | SpeakingPart) =>
  `prompts:v1:${type}:${part}`;
const HASH_SET_KEY = `prompts:v1:hashes`;
const FLAG_KEY = (id: string) => `prompts:v1:flags:${id}`;
const USAGE_KEY = (id: string) => `prompts:v1:usage:${id}`;

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

export async function getPromptFlags(id: string): Promise<PromptFlags> {
  noStore();
  const flags = await kvGetJSON<PromptFlags>(FLAG_KEY(id));
  return flags ?? {};
}

export async function setPromptFlags(
  id: string,
  patch: Partial<PromptFlags>
): Promise<PromptFlags> {
  noStore();
  const cur = await getPromptFlags(id);
  const next: PromptFlags = {
    fav: patch.fav ?? cur.fav ?? false,
    skip: patch.skip ?? cur.skip ?? false,
  };
  await kvSetJSON(FLAG_KEY(id), next);
  return next;
}

export async function enrichWithFlags(rows: PromptItem[]): Promise<PromptItemWithFlags[]> {
  noStore();
  const out = await Promise.all(
    rows.map(async (row) => {
      const flags = await getPromptFlags(row.id);
      return { ...row, flags };
    })
  );
  return out;
}

/* -------------------- Usage Tracking -------------------- */

/** Read usage stats for a single prompt. */
export async function getPromptUsage(id: string): Promise<PromptUsage> {
  noStore();
  const usage = await kvGetJSON<PromptUsage>(USAGE_KEY(id));
  return usage ?? { usedCount: 0, lastUsedTs: 0 };
}

/**
 * Mark a prompt as used — increments usedCount and sets lastUsedTs to now.
 * Returns the updated usage object (immutable — a new object is always returned).
 */
export async function markPromptUsed(promptId: string): Promise<PromptUsage> {
  noStore();
  const prev = await getPromptUsage(promptId);
  const next: PromptUsage = {
    usedCount: prev.usedCount + 1,
    lastUsedTs: Date.now(),
  };
  await kvSetJSON(USAGE_KEY(promptId), next);
  return next;
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

/** Valid part values used to coerce raw JSON entries. */
const VALID_WRITING_PARTS: readonly string[] = ["task1-ac", "task1-gt", "task2"];
const VALID_SPEAKING_PARTS: readonly string[] = ["part1", "part2", "part3"];

function coercePart(
  raw: unknown,
  type: PromptType,
): WritingPart | SpeakingPart | undefined {
  const s = String(raw ?? "").trim();
  if (type === "writing" && VALID_WRITING_PARTS.includes(s)) return s as WritingPart;
  if (type === "speaking" && VALID_SPEAKING_PARTS.includes(s)) return s as SpeakingPart;
  return undefined;
}

/**
 * Load seed prompts from public/prompts/*.json files.
 * Falls back to the hard-coded SEED_PROMPTS when no files are found.
 *
 * Supported files:
 *   - writing-seeds.json  (all writing parts)
 *   - speaking-seeds.json (all speaking parts)
 *   - Legacy: writing_task2.json, speaking_part2.json
 */
export async function seedFromFiles(): Promise<PromptItem[]> {
  noStore();

  const drafts: PromptDraft[] = [];

  /** Seed-file descriptors: new multi-part files + legacy single-part files. */
  const seedFiles: Array<{
    file: string;
    defaultType: PromptType;
    defaultPart?: WritingPart | SpeakingPart;
  }> = [
    { file: "writing-seeds.json", defaultType: "writing" },
    { file: "speaking-seeds.json", defaultType: "speaking" },
    // Legacy filenames for backward compatibility
    { file: "writing_task2.json", defaultType: "writing", defaultPart: "task2" },
    { file: "speaking_part2.json", defaultType: "speaking", defaultPart: "part2" },
  ];

  for (const sf of seedFiles) {
    const p = path.join(process.cwd(), "public", "prompts", sf.file);
    try {
      const buf = await fs.readFile(p, "utf8");
      const json: unknown = JSON.parse(buf);
      const arr: unknown[] = Array.isArray((json as any)?.items)
        ? (json as any).items
        : Array.isArray(json)
          ? (json as unknown[])
          : [];

      for (const raw of arr) {
        const r = raw as Record<string, unknown>;
        const type: PromptType =
          r.type === "writing" || r.type === "speaking"
            ? (r.type as PromptType)
            : sf.defaultType;
        const part = coercePart(r.part, type) ?? sf.defaultPart;
        if (!part) continue; // skip entries without a determinable part

        drafts.push({
          type,
          part,
          prompt: String(r.prompt ?? "").trim(),
          topicTags: normalizeTags(r.topicTags),
          followup: Array.isArray(r.followup)
            ? (r.followup as unknown[])
                .map((q) => String(q ?? "").trim())
                .filter(Boolean)
                .slice(0, 6)
            : undefined,
          level: (["5.0-6.0", "6.0-7.0", "7.0-8.0"] as PromptLevel[]).includes(
            r.level as PromptLevel,
          )
            ? (r.level as PromptLevel)
            : undefined,
          source: "seed",
        });
      }
    } catch {
      // File missing or malformed — skip silently.
    }
  }

  // Fall back to hard-coded seeds when no files were loaded.
  const toSave = drafts.length > 0 ? drafts : SEED_PROMPTS;
  if (toSave.length === 0) return [];

  const saved = await savePromptsUniq(toSave);
  return saved;
}
