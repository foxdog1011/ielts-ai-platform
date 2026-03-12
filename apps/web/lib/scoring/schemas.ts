import { z } from "zod";

const score01 = z.number().min(0).max(1);

export const WritingLlmRubricSchema = z
  .object({
    subscores: z
      .object({
        tr_01: score01,
        cc_01: score01,
        lr_01: score01,
        gra_01: score01,
      })
      .strict(),
    rationale: z
      .object({
        task_response: z.string().min(1).max(1200),
        coherence_cohesion: z.string().min(1).max(1200),
        lexical_resource: z.string().min(1).max(1200),
        grammar_range_accuracy: z.string().min(1).max(1200),
      })
      .strict(),
    paragraph_feedback: z
      .array(
        z
          .object({
            index: z.number().int().min(0),
            comment: z.string().min(1).max(800),
          })
          .strict()
      )
      .max(8),
    improvements: z.array(z.string().min(1).max(300)).max(12),
    rewritten: z.string().min(1).max(12000),
    confidence_01: score01,
  })
  .strict();

// Speaking schema uses .strip() (Zod default) on all objects so that extra
// keys the LLM occasionally adds are silently discarded rather than throwing.
// Required fields and value ranges are still fully enforced.
export const SpeakingLlmRubricSchema = z.object({
  subscores: z.object({
    content_01: score01,
    grammar_01: score01,
    vocab_01: score01,
    // Optional transcript-based estimates; used as fallback when local ML is unavailable.
    fluency_01: score01.optional(),
    pronunciation_01: score01.optional(),
  }),
  rationale: z.object({
    content: z.string().min(1).max(1200),
    grammar: z.string().min(1).max(1200),
    vocab: z.string().min(1).max(1200),
  }),
  feedback: z.string().min(1).max(3000),
  suggestions: z.array(z.string().min(1).max(300)).max(12),
  confidence_01: score01,
});

export type WritingLlmRubric = z.infer<typeof WritingLlmRubricSchema>;
export type SpeakingLlmRubric = z.infer<typeof SpeakingLlmRubricSchema>;
