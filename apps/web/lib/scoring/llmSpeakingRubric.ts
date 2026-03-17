import OpenAI from "openai";
import { ZodError } from "zod";
import { SpeakingLlmRubricSchema, type SpeakingLlmRubric } from "@/lib/scoring/schemas";
import { LlmRubricValidationError } from "@/lib/scoring/llmWritingRubric";
import { getOpenAIClient } from "@/lib/openai";

function systemPrompt() {
  return `You are an IELTS speaking examiner. Return exactly this JSON structure and nothing else — no markdown, no extra keys:
{
  "subscores": {
    "content_01": <float 0-1>,
    "grammar_01": <float 0-1>,
    "vocab_01": <float 0-1>,
    "fluency_01": <float 0-1, transcript-based estimate of spoken fluency>,
    "pronunciation_01": <float 0-1, transcript-based estimate of likely pronunciation clarity>
  },
  "rationale": {
    "content": "<brief rationale>",
    "grammar": "<brief rationale>",
    "vocab": "<brief rationale>"
  },
  "feedback": "<overall 1-3 sentence feedback>",
  "suggestions": ["<suggestion 1>", "<suggestion 2>"],
  "confidence_01": <float 0-1>
}
All scores are 0.0–1.0. fluency_01 and pronunciation_01 are estimates inferred from the transcript text.`;
}

function userPrompt(input: { prompt?: string; transcript: string }) {
  return [
    "prompt:",
    input.prompt ?? "",
    "transcript:",
    input.transcript,
  ].join("\n");
}

export async function scoreSpeakingWithLlm(input: {
  client?: OpenAI;
  transcript: string;
  prompt?: string;
  model?: string;
  temperature?: number;
}): Promise<{ rubric: SpeakingLlmRubric; tokensUsed?: number; modelUsed: string }> {
  const client = input.client ?? getOpenAIClient();
  const modelUsed = input.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const response = await client.chat.completions.create({
    model: modelUsed,
    temperature: input.temperature ?? Number(process.env.TEMPERATURE ?? 0.1),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(input) },
    ],
    max_tokens: 1200,
  });

  const text = response.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new LlmRubricValidationError("Speaking rubric returned non-JSON", err);
  }

  try {
    const rubric = SpeakingLlmRubricSchema.parse(parsed);
    return {
      rubric,
      tokensUsed: response.usage?.total_tokens,
      modelUsed,
    };
  } catch (err) {
    if (err instanceof ZodError) {
      throw new LlmRubricValidationError("Speaking rubric schema validation failed", err.issues);
    }
    throw err;
  }
}
