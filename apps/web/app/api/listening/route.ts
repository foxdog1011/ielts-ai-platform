import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MatchItem {
  left: string;
  options: string[];
  correctAnswer: string;
}

interface Option {
  label: string;
  text: string;
}

interface Question {
  id: string;
  number: number;
  type: "multiple-choice" | "fill-in-blank" | "matching";
  text: string;
  options?: Option[];
  matchItems?: MatchItem[];
  correctAnswer?: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
  transcript: string;
  questions: Question[];
}

interface SeedData {
  sections: Section[];
}

interface SubmitBody {
  answers: Record<string, string | Record<string, string>>;
}

/* ------------------------------------------------------------------ */
/*  Band conversion table                                              */
/* ------------------------------------------------------------------ */

function scoreToBand(correct: number): number {
  if (correct >= 39) return 9.0;
  if (correct >= 37) return 8.5;
  if (correct >= 35) return 8.0;
  if (correct >= 33) return 7.5;
  if (correct >= 30) return 7.0;
  if (correct >= 27) return 6.5;
  if (correct >= 23) return 6.0;
  if (correct >= 20) return 5.5;
  if (correct >= 16) return 5.0;
  if (correct >= 13) return 4.5;
  if (correct >= 10) return 4.0;
  if (correct >= 7) return 3.5;
  if (correct >= 4) return 3.0;
  return 2.5;
}

/* ------------------------------------------------------------------ */
/*  GET — return sample listening questions                            */
/* ------------------------------------------------------------------ */

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "prompts", "listening-seeds.json");
    const raw = await readFile(filePath, "utf-8");
    const data: SeedData = JSON.parse(raw);

    return NextResponse.json({
      success: true,
      data: data.sections,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load listening data";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST — submit answers and calculate score                          */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body: SubmitBody = await req.json();
    const { answers } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { success: false, error: "Missing answers object" },
        { status: 400 },
      );
    }

    const filePath = join(process.cwd(), "public", "prompts", "listening-seeds.json");
    const raw = await readFile(filePath, "utf-8");
    const data: SeedData = JSON.parse(raw);

    let totalCorrect = 0;
    let totalQuestions = 0;
    const details: Array<{
      questionId: string;
      number: number;
      correct: boolean;
      userAnswer: string | Record<string, string>;
      correctAnswer: string | Record<string, string>;
    }> = [];

    for (const section of data.sections) {
      for (const q of section.questions) {
        totalQuestions++;
        const userAnswer = answers[q.id];

        if (q.type === "matching" && q.matchItems) {
          // For matching: each sub-item is scored, but counted as 1 question
          const userMatches = (typeof userAnswer === "object" && userAnswer !== null)
            ? userAnswer as Record<string, string>
            : {};
          const correctMap: Record<string, string> = {};
          let allCorrect = true;

          for (const item of q.matchItems) {
            correctMap[item.left] = item.correctAnswer;
            if (normalise(userMatches[item.left]) !== normalise(item.correctAnswer)) {
              allCorrect = false;
            }
          }

          if (allCorrect) totalCorrect++;
          details.push({
            questionId: q.id,
            number: q.number,
            correct: allCorrect,
            userAnswer: userMatches,
            correctAnswer: correctMap,
          });
        } else {
          const userStr = typeof userAnswer === "string" ? userAnswer : "";
          const isCorrect = normalise(userStr) === normalise(q.correctAnswer ?? "");
          if (isCorrect) totalCorrect++;
          details.push({
            questionId: q.id,
            number: q.number,
            correct: isCorrect,
            userAnswer: userStr,
            correctAnswer: q.correctAnswer ?? "",
          });
        }
      }
    }

    const band = scoreToBand(totalCorrect);

    return NextResponse.json({
      success: true,
      data: {
        totalQuestions,
        totalCorrect,
        band,
        details,
        submittedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process submission";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
