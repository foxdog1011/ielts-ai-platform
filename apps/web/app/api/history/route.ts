import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/app/lib/history";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");          // 'writing' | 'speaking' | null
  const limit = Number(searchParams.get("limit") || 50);

  if (type === "writing" || type === "speaking") {
    const rows = await getHistory(type, limit);
    return NextResponse.json({ ok: true, data: rows });
  }
  // 若沒給 type，就各抓 20 筆
  const [w, s] = await Promise.all([getHistory("writing", 20), getHistory("speaking", 20)]);
  return NextResponse.json({ ok: true, data: { writing: w, speaking: s } });
}
