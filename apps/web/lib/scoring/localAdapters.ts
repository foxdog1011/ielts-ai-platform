import { runLocalScore } from "@/lib/localMl";
import { safeScore01 } from "@/lib/scoring/utils";

export async function runLocalWritingScore(essay: string, timeoutMs?: number) {
  const local = await runLocalScore({ text: essay, timeoutMs });
  if (!local.ok || !local.json) {
    return {
      ok: false as const,
      err: local.err ?? "local score failed",
      overall_01: null,
      content_01: null,
    };
  }
  return {
    ok: true as const,
    err: null,
    overall_01: safeScore01(local.json?.overall_01),
    content_01: safeScore01(local.json?.subscores_01?.content),
    raw: local.json,
  };
}

export async function runLocalSpeakingScore(input: {
  transcript?: string;
  audioPath?: string;
  timeoutMs?: number;
}) {
  const local = await runLocalScore({
    text: input.transcript,
    transcript: input.transcript,
    audio: input.audioPath,
    timeoutMs: input.timeoutMs,
  });
  if (!local.ok || !local.json) {
    return {
      ok: false as const,
      err: local.err ?? "local score failed",
      fluency_01: null,
      pronunciation_01: null,
      content_01: null,
      overall_01: null,
      speaking_features: {},
    };
  }
  return {
    ok: true as const,
    err: null,
    fluency_01: safeScore01(local.json?.subscores_01?.fluency),
    pronunciation_01: safeScore01(local.json?.subscores_01?.pronunciation),
    content_01: safeScore01(local.json?.subscores_01?.content),
    overall_01: safeScore01(local.json?.overall_01),
    speaking_features: (local.json?.speaking_features ?? {}) as Record<string, unknown>,
    raw: local.json,
  };
}
