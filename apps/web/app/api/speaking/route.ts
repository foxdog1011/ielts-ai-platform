import { NextRequest } from "next/server";
import { runSpeakingPipeline } from "@/lib/scoring/speakingPipeline";
import { runAgentPipeline } from "@/lib/agents/orchestrator";
import { listHistory } from "@/lib/history";
import { saveScore } from "@/lib/kv";
import { _handlePost } from "@/app/api/speaking/_handler";

export async function POST(req: NextRequest) {
  return _handlePost(req, {
    pipeline: runSpeakingPipeline,
    agent: runAgentPipeline,
    history: listHistory,
    save: saveScore,
    // openaiClient omitted — created lazily inside _handlePost's try block
  });
}
