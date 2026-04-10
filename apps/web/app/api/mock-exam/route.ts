// apps/web/app/api/mock-exam/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kvSetJSON, kvGetJSON, kvListPushJSON, kvListTailJSON } from "@/lib/kv";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SectionKey = "listening" | "reading" | "writing" | "speaking";

interface SectionScore {
  band: number | null;
  completedAt: string | null;
}

interface MockExam {
  id: string;
  sections: SectionKey[];
  currentSection: number;
  status: "in-progress" | "completed";
  sectionScores: Partial<Record<SectionKey, SectionScore>>;
  overallBand: number | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  KV keys                                                            */
/* ------------------------------------------------------------------ */

const EXAM_KEY = (id: string) => `mock-exam:v1:${id}`;
const EXAM_LIST_KEY = "mock-exam:v1:list";

/* ------------------------------------------------------------------ */
/*  Validation schemas                                                 */
/* ------------------------------------------------------------------ */

const sectionKeySchema = z.enum(["listening", "reading", "writing", "speaking"]);

const createSchema = z.object({
  sections: z.array(sectionKeySchema).min(1).max(4),
});

const updateSchema = z.object({
  id: z.string().min(1),
  section: sectionKeySchema,
  band: z.number().min(0).max(9).nullable(),
  advance: z.boolean().optional(),
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `me_${ts}_${rand}`;
}

function computeOverallBand(scores: Partial<Record<SectionKey, SectionScore>>): number | null {
  const bands = Object.values(scores)
    .map((s) => s?.band)
    .filter((b): b is number => b != null);

  if (bands.length === 0) return null;

  const avg = bands.reduce((sum, b) => sum + b, 0) / bands.length;
  // Round to nearest 0.5
  return Math.round(avg * 2) / 2;
}

/* ------------------------------------------------------------------ */
/*  GET /api/mock-exam                                                 */
/*  ?id=xxx  -> single exam                                            */
/*  (no id)  -> list all exams                                         */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const exam = await kvGetJSON<MockExam>(EXAM_KEY(id));
    if (!exam) {
      return NextResponse.json({ ok: false, error: "\u627E\u4E0D\u5230\u8A72\u6A21\u64EC\u8003" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: exam });
  }

  // List all exams (newest first)
  const list = await kvListTailJSON<{ id: string }>(EXAM_LIST_KEY, 100);
  const exams: MockExam[] = [];

  for (const item of list.reverse()) {
    const exam = await kvGetJSON<MockExam>(EXAM_KEY(item.id));
    if (exam) exams.push(exam);
  }

  return NextResponse.json({ ok: true, data: exams });
}

/* ------------------------------------------------------------------ */
/*  POST /api/mock-exam                                                */
/*  Create a new exam session                                          */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const examId = generateId();

  const exam: MockExam = {
    id: examId,
    sections: parsed.data.sections,
    currentSection: 0,
    status: "in-progress",
    sectionScores: {},
    overallBand: null,
    createdAt: now,
    updatedAt: now,
  };

  await kvSetJSON(EXAM_KEY(examId), exam);
  await kvListPushJSON(EXAM_LIST_KEY, { id: examId, createdAt: now });

  return NextResponse.json({ ok: true, data: { id: examId } }, { status: 201 });
}

/* ------------------------------------------------------------------ */
/*  PUT /api/mock-exam                                                 */
/*  Update section score and optionally advance to next section        */
/* ------------------------------------------------------------------ */

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { id, section, band, advance } = parsed.data;
  const exam = await kvGetJSON<MockExam>(EXAM_KEY(id));

  if (!exam) {
    return NextResponse.json({ ok: false, error: "\u627E\u4E0D\u5230\u8A72\u6A21\u64EC\u8003" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Update section score
  const updatedScores: Partial<Record<SectionKey, SectionScore>> = {
    ...exam.sectionScores,
    [section]: {
      band,
      completedAt: now,
    },
  };

  // Determine next section index
  let nextSection = exam.currentSection;
  if (advance) {
    nextSection = Math.min(exam.currentSection + 1, exam.sections.length);
  }

  // Check if all sections are done
  const allDone = nextSection >= exam.sections.length;

  const updatedExam: MockExam = {
    ...exam,
    sectionScores: updatedScores,
    currentSection: nextSection,
    status: allDone ? "completed" : "in-progress",
    overallBand: computeOverallBand(updatedScores),
    updatedAt: now,
  };

  await kvSetJSON(EXAM_KEY(id), updatedExam);

  return NextResponse.json({ ok: true, data: updatedExam });
}
