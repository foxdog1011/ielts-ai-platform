import { NextRequest, NextResponse } from "next/server";
import { getAIResponse } from "@packages/ai/index";

export async function POST(req: NextRequest) {
  const { id, essay } = await req.json();                   
  const feedback = await getAIResponse(essay, id);        
  const resultId = Date.now().toString();
  console.log("收到 essay:", essay);
  console.log("AI feedback:", feedback);
  globalThis.__RESULT_STORE__ = globalThis.__RESULT_STORE__ || {};
  globalThis.__RESULT_STORE__[resultId] = feedback;

  return NextResponse.json({ resultId, feedback });          
}


