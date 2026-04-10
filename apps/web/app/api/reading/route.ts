import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/*  Load reading seeds from public/prompts at startup                  */
/* ------------------------------------------------------------------ */

function loadSeeds() {
  const filePath = path.join(process.cwd(), "public", "prompts", "reading-seeds.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ReadingTest[];
}

interface ReadingTest {
  id: string;
  title: string;
  passages: Array<{
    number: number;
    heading: string;
    paragraphs: Array<{ label: string; text: string }>;
    questions: Array<{
      id: string;
      number: number;
      type: string;
      text: string;
      options?: string[];
      answer: string;
      explanation: string;
    }>;
  }>;
}

let _seeds: ReadingTest[] | null = null;
function getSeeds(): ReadingTest[] {
  if (_seeds === null) {
    _seeds = loadSeeds();
  }
  return _seeds;
}

/* ------------------------------------------------------------------ */
/*  Band conversion table (Academic Reading)                           */
/*  Raw score -> IELTS band                                            */
/* ------------------------------------------------------------------ */

const BAND_TABLE: ReadonlyArray<readonly [number, number]> = [
  [39, 9.0],
  [37, 8.5],
  [35, 8.0],
  [33, 7.5],
  [30, 7.0],
  [27, 6.5],
  [23, 6.0],
  [19, 5.5],
  [15, 5.0],
  [13, 4.5],
  [10, 4.0],
  [6, 3.5],
  [4, 3.0],
  [1, 2.0],
] as const;

function rawToBand(raw: number): number {
  if (raw >= 40) return 9.0;
  for (const [minRaw, band] of BAND_TABLE) {
    if (raw >= minRaw) return band;
  }
  return 1.0;
}

/* ------------------------------------------------------------------ */
/*  GET: return sample reading test data                               */
/* ------------------------------------------------------------------ */

export async function GET() {
  return NextResponse.json({ ok: true, data: getSeeds() });
}

/* ------------------------------------------------------------------ */
/*  POST: submit answers, score, return results                        */
/* ------------------------------------------------------------------ */

const AnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string(),
});

const SubmitSchema = z.object({
  testId: z.string().min(1),
  answers: z.array(AnswerSchema).min(1),
  durationSec: z.number().int().nonnegative(),
});

export async function POST(req: NextRequest) {
  try {
    const body = SubmitSchema.parse(await req.json());

    // Build answer key from seed data
    const test = getSeeds().find((t) => t.id === body.testId);
    if (!test) {
      return NextResponse.json(
        { ok: false, error: { message: "Test not found" } },
        { status: 404 },
      );
    }

    const answerKey = new Map<string, { answer: string; explanation: string }>();
    for (const passage of test.passages) {
      for (const q of passage.questions) {
        answerKey.set(q.id, { answer: q.answer, explanation: q.explanation });
      }
    }

    // Score each answer
    let correct = 0;
    const totalQuestions = answerKey.size;
    const results = body.answers.map((a) => {
      const key = answerKey.get(a.questionId);
      if (!key) {
        return {
          questionId: a.questionId,
          userAnswer: a.answer,
          correctAnswer: "N/A",
          isCorrect: false,
          explanation: "Question not found",
        };
      }

      const normalise = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, " ");
      const isCorrect = normalise(a.answer) === normalise(key.answer);
      if (isCorrect) correct += 1;

      return {
        questionId: a.questionId,
        userAnswer: a.answer,
        correctAnswer: key.answer,
        isCorrect,
        explanation: key.explanation,
      };
    });

    const band = rawToBand(correct);

    return NextResponse.json({
      ok: true,
      data: {
        testId: body.testId,
        correct,
        total: totalQuestions,
        band,
        durationSec: body.durationSec,
        results,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request body";
    return NextResponse.json(
      { ok: false, error: { message } },
      { status: 400 },
    );
  }
}
