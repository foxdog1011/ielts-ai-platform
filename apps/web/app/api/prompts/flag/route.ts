// apps/web/app/api/prompts/flag/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPromptFlags, setPromptFlags } from "../../../../lib/promptStore";

const Body = z.object({
  id: z.string().min(1),
  flag: z.enum(["fav", "skip"]),
  value: z.boolean().optional(), // 可選：若省略就 toggle
});

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());

    const cur = await getPromptFlags(body.id);
    const nextVal = body.value ?? !Boolean(cur[body.flag]);
    const next = await setPromptFlags(body.id, { [body.flag]: nextVal });

    return NextResponse.json({ ok: true, data: next });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: e?.message || "bad request" } },
      { status: 400 }
    );
  }
}
