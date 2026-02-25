import OpenAI from "openai";
import { promises as fs } from "node:fs";

export type AsrSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

export type AsrResult = {
  transcript: string;
  segments: AsrSegment[];
  usedAsr: boolean;
  modelUsed: string;
};

export async function transcribeAudio(input: {
  client?: OpenAI;
  manualTranscript?: string;
  audioBase64?: string;
  audioPath?: string;
  mime?: string;
  model?: string;
}): Promise<AsrResult> {
  const transcript = (input.manualTranscript ?? "").trim();
  const modelUsed = input.model ?? process.env.ASR_MODEL ?? "gpt-4o-mini-transcribe";
  if (transcript) {
    return { transcript, segments: [], usedAsr: false, modelUsed };
  }

  const client = input.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  let file: { name: string; data: Buffer } | null = null;
  if (input.audioBase64) {
    const mime = input.mime ?? "audio/webm";
    const ext = mime.includes("/") ? mime.split("/")[1] : "webm";
    file = {
      name: `audio.${ext}`,
      data: Buffer.from(input.audioBase64, "base64"),
    };
  } else if (input.audioPath) {
    const bytes = await fs.readFile(input.audioPath);
    const ext = input.audioPath.split(".").pop() || "wav";
    file = {
      name: `audio.${ext}`,
      data: bytes,
    };
  }

  if (!file) {
    return { transcript: "", segments: [], usedAsr: false, modelUsed };
  }

  const asr = (await client.audio.transcriptions.create({
    model: modelUsed,
    file: file as any,
    response_format: "verbose_json" as any,
    timestamp_granularities: ["segment"] as any,
  } as any)) as any;

  const outText = String(asr?.text ?? "").trim();
  const segments: AsrSegment[] = Array.isArray(asr?.segments)
    ? asr.segments
        .map((s: any) => ({
          startSec: Number(s?.start ?? 0),
          endSec: Number(s?.end ?? 0),
          text: String(s?.text ?? "").trim(),
        }))
        .filter((s: AsrSegment) => s.text.length > 0)
    : [];

  return {
    transcript: outText,
    segments,
    usedAsr: true,
    modelUsed,
  };
}
