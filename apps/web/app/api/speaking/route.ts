import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveScore } from "@/lib/kv";
import { runSpeakingPipeline } from "@/lib/scoring/speakingPipeline";

const Body = z.object({
  taskId: z.string().min(1),
  prompt: z.string().optional(),
  audioBase64: z.string().optional(),
  mime: z.string().optional(),
  audioPath: z.string().optional(),
  manualTranscript: z.string().optional(),
  durationSec: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = Body.parse(await req.json());
    const result = await runSpeakingPipeline({
      taskId: body.taskId,
      prompt: body.prompt,
      audioBase64: body.audioBase64,
      audioPath: body.audioPath,
      mime: body.mime,
      manualTranscript: body.manualTranscript,
      durationSec: body.durationSec,
    });

    await saveScore("speaking", {
      taskId: body.taskId,
      prompt: body.prompt,
      durationSec: body.durationSec,
      band: result.band,
      speakingFeatures: result.speakingFeatures,
      ts: Date.now(),
      scoreTrace: result.trace,
      llm_subscores: result.trace.llm_subscores,
      local_subscores: result.trace.local_subscores,
      weights: result.trace.weights,
      final_subscores: result.trace.final_subscores,
      final_overall_pre_calibration: result.trace.final_overall_pre_calibration,
      final_overall_post_calibration: result.trace.final_overall_post_calibration,
      final_band: result.trace.final_band,
      debug_flags: result.trace.debug_flags,
      timings: result.trace.timings,
      models: result.trace.models,
    });

    const speakingFeatures = (result.speakingFeatures ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      ok: true,
      data: {
        transcript: result.transcript,
        segments: result.segments,
        band: result.band,
        speakingFeatures: result.speakingFeatures,
        feedback: result.feedback,
        suggestions: result.suggestions,
        content: {
          band: {
            overall: result.band.overall,
            taskResponse: result.band.content,
            coherence: result.band.content,
            vocabulary: result.band.vocab,
            grammar: result.band.grammar,
          },
          suggestions: result.suggestions,
        },
        speech: {
          band: {
            overall: result.band.overall,
            pronunciation: result.band.pronunciation ?? undefined,
            fluency: result.band.fluency ?? undefined,
          },
          metrics: {
            durationSec: body.durationSec,
            wpm: typeof speakingFeatures["wpm"] === "number" ? (speakingFeatures["wpm"] as number) : undefined,
            pauseRate:
              typeof speakingFeatures["pause_ratio"] === "number"
                ? (speakingFeatures["pause_ratio"] as number)
                : undefined,
            avgPauseSec:
              typeof speakingFeatures["avg_pause_sec"] === "number"
                ? (speakingFeatures["avg_pause_sec"] as number)
                : undefined,
          },
          suggestions: [],
        },
        tokensUsed: result.tokensUsed,
        debug: result.debug,
      },
      requestId,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SPEAKING_SCORING_FAILED",
          message: e?.message || "speaking scoring failed",
        },
        requestId,
      },
      { status: 400 }
    );
  }
}
