import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  savePromptsUniq,
  seedFromFiles,
  type PromptDraft,
  type PromptLevel,
  type PromptType,
  type WritingPart,
  type SpeakingPart,
} from "@/lib/promptStore";

const Body = z.object({
  items: z.array(
    z.object({
      type: z.enum(["writing","speaking"]) as z.ZodType<PromptType>,
      part: z.string(),
      prompt: z.string().min(10),
      topicTags: z.array(z.string()).max(6).default([]),
      followup: z.array(z.string()).optional(),
      level: z.enum(["5.0-6.0","6.0-7.0","7.0-8.0"]).optional(),
      source: z.enum(["seed","ai-gen","manual"]).optional(),
    })
  ).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 這裡改成容錯讀 body：沒 body 就當成 {}
    let raw = "";
    try { raw = await req.text(); } catch {}
    const data = raw ? JSON.parse(raw) : {};
    const parsed = Body.safeParse(data);

    if (!parsed.success || !parsed.data?.items?.length) {
      // 沒給 items → 走檔案 + 內建種子
      const saved = await seedFromFiles();
      return NextResponse.json({ ok: true, data: { created: saved.length, items: saved } });
    }

    const drafts: PromptDraft[] = parsed.data.items.map((x) => ({
      type: x.type,
      part: (x.part as any) as WritingPart | SpeakingPart,
      prompt: x.prompt.trim(),
      topicTags: (x.topicTags || []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0,4),
      followup: Array.isArray(x.followup) ? x.followup.map((q)=>q.trim()).filter(Boolean).slice(0,6) : undefined,
      level: x.level as PromptLevel | undefined,
      source: x.source ?? "seed",
    }));

    const saved = await savePromptsUniq(drafts);
    return NextResponse.json({ ok: true, data: { created: saved.length, items: saved } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: { message: e?.message || "seed failed" } }, { status: 500 });
  }
}
