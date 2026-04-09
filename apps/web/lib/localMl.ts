// apps/web/lib/localMl.ts
// Calls the FastAPI ML scoring service over HTTP.
// Falls back to null/disabled when ML_SERVICE_URL is not configured.

export type LocalScore = {
  ok: boolean;
  json?: any;
  err?: string;
};

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "";
const DEFAULT_TIMEOUT_MS = 30_000;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

export async function runLocalScore(opts: {
  text?: string;
  audio?: string;
  transcript?: string;
  timeoutMs?: number;
}): Promise<LocalScore> {
  if (!ML_SERVICE_URL) {
    return { ok: false, err: "ML_SERVICE_URL not set" };
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // If audio path is provided, use the speaking endpoint
  if (opts.audio) {
    return scoreSpeaking(opts.audio, opts.transcript, timeoutMs);
  }

  // Otherwise use the writing endpoint
  const textForContent = opts.text || opts.transcript || "";
  if (!textForContent.trim()) {
    return { ok: false, err: "No text provided for scoring" };
  }

  return scoreWriting(textForContent, timeoutMs);
}

async function scoreWriting(
  text: string,
  timeoutMs: number,
): Promise<LocalScore> {
  const url = `${ML_SERVICE_URL}/score/writing`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "unknown error");
      return { ok: false, err: `ML service returned ${response.status}: ${detail}` };
    }

    const json = await response.json();
    return { ok: true, json };
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (msg.includes("abort")) {
      return { ok: false, err: "timeout" };
    }
    return { ok: false, err: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function scoreSpeaking(
  audioPath: string,
  transcript: string | undefined,
  timeoutMs: number,
): Promise<LocalScore> {
  // For speaking, we need to send the audio file as multipart/form-data.
  // On the server side (Next.js API route), the audio is already a file path.
  // We read the file and send it to the ML service.
  const fs = await import("node:fs");
  const path = await import("node:path");

  if (!fs.existsSync(audioPath)) {
    return { ok: false, err: `Audio file not found: ${audioPath}` };
  }

  const url = `${ML_SERVICE_URL}/score/speaking`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fileBuffer = fs.readFileSync(audioPath);
    const fileName = path.basename(audioPath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("audio", blob, fileName);
    if (transcript) {
      formData.append("transcript", transcript);
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "unknown error");
      return { ok: false, err: `ML service returned ${response.status}: ${detail}` };
    }

    const json = await response.json();
    return { ok: true, json };
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (msg.includes("abort")) {
      return { ok: false, err: "timeout" };
    }
    return { ok: false, err: msg };
  } finally {
    clearTimeout(timer);
  }
}
