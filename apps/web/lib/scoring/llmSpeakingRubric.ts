import OpenAI from "openai";
import { ZodError } from "zod";
import { SpeakingLlmRubricSchema, type SpeakingLlmRubric } from "@/lib/scoring/schemas";
import { LlmRubricValidationError } from "@/lib/scoring/llmWritingRubric";

function systemPrompt() {
  return [
    "You are an IELTS speaking examiner.",
    "Return one strict JSON object only.",
    "Use 0..1 scores for content_01, grammar_01, vocab_01.",
    "Do not score fluency/pronunciation in this rubric.",
    "No extra keys, no markdown.",
  ].join("\n");
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
  const client = input.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
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
