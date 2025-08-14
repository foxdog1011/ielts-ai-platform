import { NextRequest, NextResponse } from "next/server";
import {
  listPrompts,
  enrichWithFlags,
  type WritingPart,
  type SpeakingPart,
  type PromptFlags,
} from "../../../lib/promptStore";

const WRITING_PARTS = ["task1-ac", "task1-gt", "task2"] as const;
const SPEAKING_PARTS = ["part1", "part2", "part3"] as const;
const LEVELS = ["5.0-6.0", "6.0-7.0", "7.0-8.0"] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // type 縮小
  const typeParam = searchParams.get("type");
  const type = typeParam === "writing" || typeParam === "speaking" ? typeParam : undefined;

  // part 縮小
  const partParam = searchParams.get("part") || undefined;
  let part: WritingPart | SpeakingPart | undefined = undefined;
  if (partParam && (WRITING_PARTS as readonly string[]).includes(partParam)) {
    part = partParam as WritingPart;
  } else if (partParam && (SPEAKING_PARTS as readonly string[]).includes(partParam)) {
    part = partParam as SpeakingPart;
  }

  // level 縮小
  const levelParam = searchParams.get("level") || undefined;
  const level = levelParam && (LEVELS as readonly string[]).includes(levelParam)
    ? (levelParam as (typeof LEVELS)[number])
    : undefined;

  const topic = searchParams.get("topic") || undefined;

  const limit = Number(searchParams.get("limit") || 50);
  const offset = Number(searchParams.get("offset") || 0);

  // flags 篩選條件（favOnly, hideSkipped）
  const favOnly = ["1", "true", "yes"].includes((searchParams.get("favOnly") || "").toLowerCase());
  const hideSkipped = ["1", "true", "yes"].includes((searchParams.get("hideSkipped") || "").toLowerCase());

  let rows = await listPrompts({
    type,
    part,
    topic,
    level,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  // 併入 flags
  const withFlags = await enrichWithFlags(rows);

  // 依 flags 過濾
  const filtered = withFlags.filter((r) => {
    const f = (r.flags || {}) as PromptFlags;
    if (favOnly && !f.fav) return false;
    if (hideSkipped && f.skip) return false;
    return true;
  });

  return NextResponse.json({ ok: true, data: filtered });
}
