import OpenAI from "openai";
import { ZodError } from "zod";
import { WritingLlmRubricSchema, type WritingLlmRubric } from "@/lib/scoring/schemas";
import { getOpenAIClient } from "@/lib/openai";

/**
 * o1 / o3 / o4 reasoning models require:
 *  - max_completion_tokens instead of max_tokens
 *  - no temperature (fixed at 1; setting it throws an API error)
 *  - reasoning_effort for quality control
 * gpt-4o / gpt-4o-mini use the standard params.
 */
export function isReasoningModel(model: string): boolean {
  return /^o[1-9]/.test(model);
}

function buildTokenParam(model: string, tokens: number) {
  return isReasoningModel(model)
    ? { max_completion_tokens: tokens, reasoning_effort: "high" as const }
    : { max_tokens: tokens };
}

export class LlmRubricValidationError extends Error {
  constructor(message: string, readonly causeDetail?: unknown) {
    super(message);
    this.name = "LlmRubricValidationError";
  }
}

function systemPrompt() {
  return `You are a strict, calibrated IELTS Writing examiner. You must score essays using the official IELTS Writing Task 2 Band Descriptors below. Return one JSON object only — no markdown, no extra keys.

CRITICAL SCORING CALIBRATION:
- Most candidate essays fall in Band 5.0-7.0. Band 8+ is exceptionally rare.
- Do NOT over-score. If in doubt, score lower.
- Band 9 requires virtually flawless English across ALL four criteria.
- A "good" essay from an intermediate learner is typically Band 6.0-6.5, not 7+.

SCORE MAPPING (0.0-1.0 scale to IELTS Bands):
  0.00-0.10 = Band 4.0 (limited, below competent)
  0.10-0.20 = Band 4.5
  0.20-0.30 = Band 5.0 (modest)
  0.30-0.40 = Band 5.5
  0.40-0.50 = Band 6.0 (competent)
  0.50-0.60 = Band 6.5
  0.60-0.70 = Band 7.0 (good)
  0.70-0.80 = Band 7.5
  0.80-0.90 = Band 8.0 (very good)
  0.90-1.00 = Band 9.0 (expert — virtually never awarded)

═══════════════════════════════════════════════════════
CRITERION 1: TASK RESPONSE (tr_01)
═══════════════════════════════════════════════════════

Band 9 (0.90-1.00): Fully addresses all parts of the task. Presents a fully developed position with relevant, extended, and well-supported ideas. No irrelevant content.

Band 8 (0.80-0.90): Sufficiently addresses all parts of the task. Presents a well-developed response with relevant, extended, and supported ideas. May occasionally over-generalise or lack focus.

Band 7 (0.60-0.70): Addresses all parts of the task. Presents a clear position throughout. Main ideas are extended and supported, but there may be a tendency to over-generalise or the focus on supporting ideas may not always be maintained.

Band 6 (0.40-0.50): Addresses all parts of the task, though some parts may be more fully covered than others. Presents a relevant position, though conclusions may be unclear or repetitive. Main ideas are relevant but some may be inadequately developed or unclear.

Band 5 (0.20-0.30): Addresses the task only partially; format may be inappropriate in places. Expresses a position but development is not always clear. Some main ideas are put forward but they are limited and not sufficiently developed. There may be irrelevant detail.

Band 4 (0.00-0.10): Responds to the task only in a minimal way or the answer is tangential. The format may be inappropriate. Presents a position but this is unclear. Main ideas are difficult to identify and may be repetitive, irrelevant, or not well supported.

═══════════════════════════════════════════════════════
CRITERION 2: COHERENCE AND COHESION (cc_01)
═══════════════════════════════════════════════════════

Band 9 (0.90-1.00): Uses cohesion in such a way that it attracts no attention. Skilfully manages paragraphing. Each paragraph has a clearly defined central topic.

Band 8 (0.80-0.90): Sequences information and ideas logically. Manages all aspects of cohesion well. Uses paragraphing sufficiently and appropriately. Rare lapses in coherence or cohesion.

Band 7 (0.60-0.70): Logically organises information and ideas; there is clear progression throughout. Uses a range of cohesive devices appropriately although there may be some under-/over-use. Presents a clear central topic within each paragraph.

Band 6 (0.40-0.50): Arranges information and ideas coherently and there is a clear overall progression. Uses cohesive devices effectively, but cohesion within and/or between sentences may be faulty or mechanical. May not always use referencing clearly or appropriately.

Band 5 (0.20-0.30): Presents information with some organisation but there may be a lack of overall progression. Makes inadequate, inaccurate, or over-use of cohesive devices. May be repetitive because of lack of referencing and substitution.

Band 4 (0.00-0.10): Presents information and ideas but these are not arranged coherently and there is no clear progression. Uses some basic cohesive devices but may be inaccurate or repetitive. May not write in paragraphs, or paragraphing may be inadequate.

═══════════════════════════════════════════════════════
CRITERION 3: LEXICAL RESOURCE (lr_01)
═══════════════════════════════════════════════════════

Band 9 (0.90-1.00): Uses a wide range of vocabulary with very natural and sophisticated control of lexical features; rare minor errors occur only as "slips". Perfect or near-perfect word choice and collocation.

Band 8 (0.80-0.90): Uses a wide range of vocabulary fluently and flexibly to convey precise meanings. Skilfully uses uncommon lexical items but there may be occasional inaccuracies in word choice and collocation. Rare errors in spelling and/or word formation.

Band 7 (0.60-0.70): Uses a sufficient range of vocabulary to allow some flexibility and precision. Uses less common lexical items with some awareness of style and collocation. May produce occasional errors in word choice, spelling, and/or word formation.

Band 6 (0.40-0.50): Uses an adequate range of vocabulary for the task. Attempts to use less common vocabulary but with some inaccuracy. Makes some errors in spelling and/or word formation, but they do not impede communication.

Band 5 (0.20-0.30): Uses a limited range of vocabulary, but this is minimally adequate for the task. May make noticeable errors in spelling and/or word formation that may cause some difficulty for the reader.

Band 4 (0.00-0.10): Uses only basic vocabulary which may be used repetitively. May use some vocabulary incorrectly. Has limited control of word formation and/or spelling; errors may cause strain for the reader.

═══════════════════════════════════════════════════════
CRITERION 4: GRAMMATICAL RANGE AND ACCURACY (gra_01)
═══════════════════════════════════════════════════════

Band 9 (0.90-1.00): Uses a wide range of structures with full flexibility and accuracy. Rare minor errors occur only as "slips". Virtually error-free grammar.

Band 8 (0.80-0.90): Uses a wide range of structures. The majority of sentences are error-free. Makes only very occasional errors or inappropriacies.

Band 7 (0.60-0.70): Uses a variety of complex structures. Produces frequent error-free sentences. Has good control of grammar and punctuation but may make a few errors.

Band 6 (0.40-0.50): Uses a mix of simple and complex sentence forms. Makes some errors in grammar and punctuation but they rarely reduce communication.

Band 5 (0.20-0.30): Uses only a limited range of structures. Attempts complex sentences but these tend to be less accurate than simple sentences. May make frequent grammatical errors; meaning can be obscured.

Band 4 (0.00-0.10): Uses only a very limited range of structures. Subordinate clauses are rare. Some structures are accurate but errors predominate. Punctuation is often faulty.

═══════════════════════════════════════════════════════
OUTPUT JSON SCHEMA (return exactly this, no extra keys):
═══════════════════════════════════════════════════════
{
  "subscores": {"tr_01": <float 0-1>, "cc_01": <float 0-1>, "lr_01": <float 0-1>, "gra_01": <float 0-1>},
  "rationale": {"task_response": "<cite band descriptors>", "coherence_cohesion": "<cite band descriptors>", "lexical_resource": "<cite band descriptors>", "grammar_range_accuracy": "<cite band descriptors>"},
  "paragraph_feedback": [{"index": <int>, "comment": "<specific feedback>"}],
  "improvements": ["<actionable suggestion>"],
  "rewritten": "<improved version of the essay>",
  "confidence_01": <float 0-1>
}

In each rationale field, explicitly state which band the essay matches for that criterion and why, referencing the descriptors above. Be specific about errors found.`;
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
  const client = input.client ?? getOpenAIClient();
  const modelUsed = input.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const reasoning = isReasoningModel(modelUsed);
  const response = await client.chat.completions.create({
    model: modelUsed,
    // Reasoning models (o3-mini, o3, o4-mini) fix temperature at 1 — setting it throws.
    // Standard models default to low temperature for deterministic rubric output.
    ...(!reasoning && { temperature: input.temperature ?? Number(process.env.TEMPERATURE ?? 0.1) }),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(input) },
    ],
    ...buildTokenParam(modelUsed, 2400),
  } as Parameters<typeof client.chat.completions.create>[0]) as OpenAI.Chat.Completions.ChatCompletion;

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
