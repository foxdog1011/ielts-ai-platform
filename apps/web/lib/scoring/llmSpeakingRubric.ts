import OpenAI from "openai";
import { ZodError } from "zod";
import { SpeakingLlmRubricSchema, type SpeakingLlmRubric } from "@/lib/scoring/schemas";
import { LlmRubricValidationError, isReasoningModel } from "@/lib/scoring/llmWritingRubric";
import { getOpenAIClient } from "@/lib/openai";

function buildTokenParam(model: string, tokens: number) {
  return isReasoningModel(model)
    ? { max_completion_tokens: tokens, reasoning_effort: "high" as const }
    : { max_tokens: tokens };
}

type SpeakingPartNum = 1 | 2 | 3;

function partSpecificGuidance(part: SpeakingPartNum): string {
  if (part === 1) {
    return `
PART-SPECIFIC GUIDANCE — PART 1 (Short Q&A, familiar topics):
- Responses should be 2-3 sentences per question. Overly long answers are NOT better.
- Focus on FLUENCY and NATURAL CONVERSATION: Can the candidate respond promptly and naturally?
- Vocabulary range expectations are LOWER than Part 2/3 — familiar topic vocabulary is sufficient.
- Grammar complexity expectations are MODERATE — simple but accurate structures are acceptable at Band 6+.
- Penalise candidates who give one-word answers or cannot expand at all.
- Do NOT penalise for lack of abstract reasoning — that belongs to Part 3.
`;
  }
  if (part === 3) {
    return `
PART-SPECIFIC GUIDANCE — PART 3 (Abstract discussion):
- Responses should be 4-8 sentences per question. Longer, developed answers are expected.
- Focus on ABILITY TO DISCUSS ABSTRACT TOPICS: Can the candidate give opinions, develop arguments, and consider multiple perspectives?
- Vocabulary range expectations are HIGHER — candidates should use topic-specific and abstract vocabulary.
- Grammar complexity expectations are HIGH — complex structures (conditionals, passive, relative clauses) expected at Band 6+.
- Penalise candidates who only give surface-level answers without justification or examples.
- Reward candidates who can speculate, compare, evaluate, and develop ideas coherently.
`;
  }
  return `
PART-SPECIFIC GUIDANCE — PART 2 (Long turn / Cue card):
- The candidate should speak for 1-2 minutes on the given topic.
- Focus on ability to speak at length, organise ideas, and cover all bullet points on the cue card.
- Expect a balance of description, narration, and explanation.
`;
}

function systemPrompt(part: SpeakingPartNum = 2) {
  return `You are a strict, calibrated IELTS Speaking examiner. You must score transcripts using the official IELTS Speaking Band Descriptors below. Return exactly one JSON object — no markdown, no extra keys.
${partSpecificGuidance(part)}
CRITICAL SCORING CALIBRATION:
- Most candidates fall in Band 5.0-7.0. Band 8+ is exceptionally rare.
- Do NOT over-score. If in doubt, score lower.
- Band 9 requires native-like fluency, precision, and range across ALL criteria.
- A "good" intermediate speaker is typically Band 6.0-6.5, not 7+.

SCORE MAPPING (0.0-1.0 scale to IELTS Bands):
  0.00-0.10 = Band 4.0 (limited)
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
CRITERION 1: CONTENT / TASK FULFILMENT (content_01)
(maps to IELTS "Fluency & Coherence" for topic relevance and idea development)
═══════════════════════════════════════════════════════

Band 9 (0.90-1.00): Speaks fluently with only rare repetition or self-correction. Discourse is coherent with fully appropriate cohesive features. Topic is developed fully and relevantly with sophisticated ideas.

Band 8 (0.80-0.90): Speaks fluently with only occasional repetition or self-correction. Develops topics coherently and appropriately. Ideas are relevant, extended, and well-supported.

Band 7 (0.60-0.70): Speaks at length without noticeable effort or loss of coherence. May demonstrate language-related hesitation at times. Uses a range of connectives and discourse markers with some flexibility. Ideas are relevant but may lack full development.

Band 6 (0.40-0.50): Is willing to speak at length, though may lose coherence at times due to occasional repetition, self-correction, or hesitation. Uses a range of connectives and discourse markers but not always appropriately. Ideas are relevant but may be insufficiently developed.

Band 5 (0.20-0.30): Usually maintains flow of speech but uses repetition, self-correction, and/or slow speech to keep going. May over-use certain connectives and discourse markers. Produces simple speech fluently, but more complex communication causes problems. Ideas may be limited or not fully relevant.

Band 4 (0.00-0.10): Cannot respond without noticeable pauses and may speak slowly, with frequent repetition. Links basic sentences but with repetitious use of connectives. Ideas are limited and not clearly connected to the topic.

═══════════════════════════════════════════════════════
CRITERION 2: GRAMMATICAL RANGE AND ACCURACY (grammar_01)
═══════════════════════════════════════════════════════

Band 9 (0.90-1.00): Uses a full range of structures naturally and appropriately. Produces consistently accurate structures apart from "slips" characteristic of native speaker speech.

Band 8 (0.80-0.90): Uses a wide range of structures flexibly. Produces a majority of error-free sentences with only very occasional inappropriacies or basic errors.

Band 7 (0.60-0.70): Uses a range of complex structures with some flexibility. Frequently produces error-free sentences, though some grammatical mistakes persist.

Band 6 (0.40-0.50): Uses a mix of simple and complex structures, but with limited flexibility. May make frequent mistakes with complex structures, though these rarely cause comprehension problems.

Band 5 (0.20-0.30): Produces basic sentence forms with reasonable accuracy. Uses a limited range of more complex structures, but these usually contain errors. Errors may cause some comprehension difficulty.

Band 4 (0.00-0.10): Produces basic sentence forms and some correct simple sentences but subordinate structures are rarely attempted. Errors are frequent and may cause misunderstanding.

═══════════════════════════════════════════════════════
CRITERION 3: LEXICAL RESOURCE / VOCABULARY (vocab_01)
═══════════════════════════════════════════════════════

Band 9 (0.90-1.00): Uses vocabulary with full flexibility and precision in all topics. Uses idiomatic language naturally and accurately.

Band 8 (0.80-0.90): Uses a wide vocabulary resource readily and flexibly to convey precise meaning. Uses less common and idiomatic vocabulary skilfully, with occasional inaccuracies.

Band 7 (0.60-0.70): Uses vocabulary resource flexibly to discuss a variety of topics. Uses some less common and idiomatic vocabulary and shows some awareness of style and collocation, with some inappropriate choices.

Band 6 (0.40-0.50): Has a wide enough vocabulary to discuss topics at length and make meaning clear in spite of inappropriacies. Generally paraphrases successfully.

Band 5 (0.20-0.30): Manages to talk about familiar and unfamiliar topics but uses vocabulary with limited flexibility. Attempts to use paraphrase but with mixed success.

Band 4 (0.00-0.10): Is able to talk about familiar topics but can only convey basic meaning on unfamiliar topics. Makes frequent errors in word choice. Rarely attempts paraphrase.

═══════════════════════════════════════════════════════
CRITERION 4: FLUENCY (fluency_01) — TRANSCRIPT-BASED ESTIMATE
═══════════════════════════════════════════════════════

IMPORTANT: fluency_01 is estimated from a text transcript only — you cannot hear the actual speech. This means you CANNOT reliably assess pausing, speech rate, intonation, or rhythm. You can only infer fluency from:
  - Frequency of self-corrections, false starts, and filler words in the transcript
  - Sentence completeness and flow
  - Evidence of hesitation markers (um, uh, er, like, you know)

Because of this inherent limitation, be CONSERVATIVE:
  - Default range should be 0.40-0.65 unless strong evidence otherwise
  - Only score above 0.70 if the transcript shows virtually no hesitation markers, complete well-formed sentences, and natural discourse flow
  - Only score below 0.30 if the transcript shows pervasive fragmentation, constant false starts, or inability to form complete thoughts

═══════════════════════════════════════════════════════
CRITERION 5: PRONUNCIATION (pronunciation_01) — TRANSCRIPT-BASED ESTIMATE
═══════════════════════════════════════════════════════

IMPORTANT: pronunciation_01 is estimated from a text transcript only — you CANNOT hear the actual speech. Pronunciation accuracy is largely unobservable from text. You can only infer:
  - Phonetic spelling errors that suggest pronunciation issues
  - Consistent misspellings of specific sounds
  - Word stress errors visible in transcription errors

Because of this severe limitation, be VERY CONSERVATIVE:
  - Default to 0.50 (Band 6 range) unless clear textual evidence suggests otherwise
  - Range should almost always be 0.40-0.65
  - Only deviate significantly if the transcript contains clear phonetic misspellings suggesting systematic pronunciation problems (score lower) or if the transcript is from a verified accurate ASR system and shows no such issues
  - Set confidence_01 lower when pronunciation is a major factor in your assessment

═══════════════════════════════════════════════════════
OUTPUT JSON SCHEMA (return exactly this, no extra keys):
═══════════════════════════════════════════════════════
{
  "subscores": {
    "content_01": <float 0-1>,
    "grammar_01": <float 0-1>,
    "vocab_01": <float 0-1>,
    "fluency_01": <float 0-1, conservative transcript-based estimate>,
    "pronunciation_01": <float 0-1, conservative transcript-based estimate>
  },
  "rationale": {
    "content": "<cite band descriptors, state which band and why>",
    "grammar": "<cite band descriptors, state which band and why>",
    "vocab": "<cite band descriptors, state which band and why>"
  },
  "feedback": "<overall 1-3 sentence feedback>",
  "suggestions": ["<actionable suggestion>"],
  "confidence_01": <float 0-1, lower if fluency/pronunciation estimates are uncertain>
}

In each rationale field, explicitly state which band the candidate matches for that criterion and why, referencing the descriptors above. Be specific about errors found.`;
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
  part?: SpeakingPartNum;
}): Promise<{ rubric: SpeakingLlmRubric; tokensUsed?: number; modelUsed: string }> {
  const client = input.client ?? getOpenAIClient();
  const modelUsed = input.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const reasoning = isReasoningModel(modelUsed);
  const part = input.part ?? 2;
  const response = await client.chat.completions.create({
    model: modelUsed,
    ...(!reasoning && { temperature: input.temperature ?? Number(process.env.TEMPERATURE ?? 0.1) }),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt(part) },
      { role: "user", content: userPrompt(input) },
    ],
    ...buildTokenParam(modelUsed, 1800),
  } as Parameters<typeof client.chat.completions.create>[0]) as OpenAI.Chat.Completions.ChatCompletion;

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
