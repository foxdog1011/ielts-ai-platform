import { NextRequest, NextResponse } from "next/server";
import { getAIResponse } from "@packages/ai/index";

export async function POST(req: NextRequest) {
  const { id, essay } = await req.json();

  const feedback = await getAIResponse(essay, id); // 呼叫 AI 模組

  const resultId = Date.now().toString(); // 可以改成 UUID
  globalThis.__RESULT_STORE__ = globalThis.__RESULT_STORE__ || {};
  globalThis.__RESULT_STORE__[resultId] = feedback;

  return NextResponse.json({ resultId, feedback }); // feedback 也可省略，只顯示在 result/[id]
}
