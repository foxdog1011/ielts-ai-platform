import OpenAI from "openai";
import { ZodError } from "zod";
import { WritingLlmRubricSchema, type WritingLlmRubric } from "@/lib/scoring/schemas";

export class LlmRubricValidationError extends Error {
  constructor(message: string, readonly causeDetail?: unknown) {
    super(message);
    this.name = "LlmRubricValidationError";
  }
}

function systemPrompt() {
  return [
    "You are an IELTS writing examiner.",
    "Return one JSON object only.",
    "Use 0..1 scores for each rubric dimension.",
    "Schema:",
    "{",
    '  "subscores": {"tr_01": number, "cc_01": number, "lr_01": number, "gra_01": number},',
    '  "rationale": {"task_response": string, "coherence_cohesion": string, "lexical_resource": string, "grammar_range_accuracy": string},',
    '  "paragraph_feedback": [{"index": number, "comment": string}],',
    '  "improvements": [string],',
    '  "rewritten": string,',
    '  "confidence_01": number',
    "}",
    "No extra keys. No markdown.",
  ].join("\n");
}

function userPrompt(input: { essay: string; taskType?: string; promptContext?: string }) {
  return [
    `task_type=${input.taskType ?? "task2"}`,
    `prompt_context=${input.promptContext ?? ""}`,
    "essay:",
    input.essay,
  ].join("\n");
}

export async function scoreWritingWithLlm(input: {
  client?: OpenAI;
  essay: string;
  taskType?: string;
  promptContext?: string;
  model?: string;
  temperature?: number;
}): Promise<{ rubric: WritingLlmRubric; tokensUsed?: number; modelUsed: string }> {
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
    max_tokens: 1600,
  });

  const text = response.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new LlmRubricValidationError("Writing rubric returned non-JSON", err);
  }

  try {
    const rubric = WritingLlmRubricSchema.parse(parsed);
    return {
      rubric,
      tokensUsed: response.usage?.total_tokens,
      modelUsed,
    };
  } catch (err) {
    if (err instanceof ZodError) {
      throw new LlmRubricValidationError("Writing rubric schema validation failed", err.issues);
    }
    throw err;
  }
}
