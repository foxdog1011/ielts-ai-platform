"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Paragraph {
  label: string;
  text: string;
}

interface Question {
  id: string;
  number: number;
  type: "true-false-not-given" | "matching-headings" | "fill-in-blank" | "multiple-choice" | "sentence-completion";
  text: string;
  options?: string[];
  answer: string;
  explanation: string;
}

interface Passage {
  number: number;
  heading: string;
  paragraphs: Paragraph[];
  questions: Question[];
}

interface ReadingTest {
  id: string;
  title: string;
  passages: Passage[];
}

interface QuestionResult {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

interface ScoreResult {
  testId: string;
  correct: number;
  total: number;
  band: number;
  durationSec: number;
  results: QuestionResult[];
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const TOTAL_SECONDS = 60 * 60; // 60 minutes

const COLORS = {
  green: "#58CC02",
  yellow: "#FFD900",
  coral: "#FF4B4B",
  blue: "#1CB0F6",
  purple: "#CE82FF",
} as const;

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function ReadingPage() {
  /* ---- State ---- */
  const [tests, setTests] = useState<ReadingTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activePassage, setActivePassage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [hoveredParagraph, setHoveredParagraph] = useState<string | null>(null);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ---- Fetch data ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/reading");
        if (!res.ok) throw new Error("Failed to load reading data");
        const json = await res.json();
        if (!cancelled) {
          setTests(json.data ?? []);
          setLoading(false);
          setTimerRunning(true);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ---- Timer ---- */
  useEffect(() => {
    if (!timerRunning || submitted) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, submitted]);

  /* ---- Derived ---- */
  const test = tests[0] as ReadingTest | undefined;
  const passages = test?.passages ?? [];
  const currentPassage = passages[activePassage] as Passage | undefined;

  const allQuestions = useMemo(
    () => passages.flatMap((p) => p.questions),
    [passages],
  );

  const answeredCount = useMemo(
    () => allQuestions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [allQuestions, answers],
  );

  /* ---- Handlers ---- */
  const setAnswer = useCallback((qId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }, []);

  const scrollToQuestion = useCallback((qId: string) => {
    questionRefs.current[qId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!test || submitting) return;
    setSubmitting(true);
    try {
      const elapsed = TOTAL_SECONDS - secondsLeft;
      const payload = {
        testId: test.id,
        answers: allQuestions.map((q) => ({
          questionId: q.id,
          answer: (answers[q.id] ?? "").trim(),
        })),
        durationSec: elapsed,
      };
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Submit failed");
      const json = await res.json();
      setScoreResult(json.data);
      setSubmitted(true);
      setTimerRunning(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "提交失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  }, [test, submitting, secondsLeft, allQuestions, answers]);

  /* ---- Format timer ---- */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const timerColor = secondsLeft <= 300 ? COLORS.coral : secondsLeft <= 600 ? COLORS.yellow : COLORS.green;

  /* ---- Loading / Error ---- */
  if (loading) {
    return (
      <main className="min-h-dvh bg-[#F7F7F7] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-[#1CB0F6] flex items-center justify-center mx-auto shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] animate-pulse">
            <span className="text-white text-lg font-bold">R</span>
          </div>
          <p className="text-[15px] font-bold text-gray-500">載入閱讀測驗中...</p>
        </div>
      </main>
    );
  }

  if (error || !test) {
    return (
      <main className="min-h-dvh bg-[#F7F7F7] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[15px] font-bold text-[#FF4B4B]">{error ?? "無法載入測驗資料"}</p>
          <Link href="/" className="inline-block rounded-2xl border-2 border-gray-200 bg-white px-6 py-3 text-[14px] font-bold shadow-[3px_3px_0_0_rgba(0,0,0,0.1)] hover:border-[#58CC02] transition-all">
            返回首頁
          </Link>
        </div>
      </main>
    );
  }

  /* ---- Score screen ---- */
  if (submitted && scoreResult) {
    return <ScoreScreen result={scoreResult} allQuestions={allQuestions} />;
  }

  /* ---- Main exam UI ---- */
  return (
    <main className="min-h-dvh bg-[#F7F7F7] font-brand">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b-2 border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-[#1CB0F6] flex items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]">
              <span className="text-white text-[11px] font-bold">R</span>
            </div>
            <span className="text-[15px] font-bold text-gray-800 hidden sm:inline">閱讀模擬測驗</span>
          </Link>

          {/* Passage pills */}
          <div className="flex items-center gap-2">
            {passages.map((p, i) => {
              const passageQuestions = p.questions;
              const passageAnswered = passageQuestions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
              const isActive = activePassage === i;
              return (
                <button
                  key={p.number}
                  onClick={() => setActivePassage(i)}
                  className={[
                    "rounded-2xl border-2 px-4 py-2 text-[13px] font-bold transition-all min-h-[40px]",
                    isActive
                      ? "bg-[#1CB0F6] text-white border-[#1CB0F6] shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#1CB0F6] hover:text-[#1CB0F6]",
                  ].join(" ")}
                >
                  Passage {p.number}
                  <span className="ml-1.5 text-[11px] opacity-70">
                    ({passageAnswered}/{passageQuestions.length})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Timer + controls */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="rounded-2xl border-2 px-4 py-2 font-mono text-[15px] font-bold shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]"
              style={{ borderColor: timerColor, color: timerColor }}
            >
              {formatTime(secondsLeft)}
            </div>
            <button
              onClick={() => setShowAnswerSheet((v) => !v)}
              className="rounded-2xl border-2 border-[#CE82FF] bg-white px-3 py-2 text-[13px] font-bold text-[#CE82FF] hover:bg-[#CE82FF]/10 transition-all shadow-[2px_2px_0_0_rgba(0,0,0,0.08)] hidden sm:block"
            >
              答題卡
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-2xl border-2 border-[#58CC02] bg-[#58CC02] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#4CAF00] transition-all shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] disabled:opacity-50"
            >
              {submitting ? "提交中..." : "交卷"}
            </button>
          </div>
        </div>
      </header>

      {/* Body: split view */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Passage */}
          <section className="flex-1 min-w-0">
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 sm:p-8 shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]">
              <h2 className="text-[18px] font-bold text-gray-800 mb-6">
                {currentPassage?.heading}
              </h2>
              <div className="space-y-4">
                {currentPassage?.paragraphs.map((para) => (
                  <div
                    key={para.label}
                    className={[
                      "flex gap-3 rounded-xl p-3 -mx-3 transition-all cursor-default",
                      hoveredParagraph === para.label
                        ? "bg-[#1CB0F6]/5 border border-[#1CB0F6]/20"
                        : "border border-transparent",
                    ].join(" ")}
                    onMouseEnter={() => setHoveredParagraph(para.label)}
                    onMouseLeave={() => setHoveredParagraph(null)}
                  >
                    <span className="shrink-0 w-7 h-7 rounded-lg bg-[#1CB0F6]/10 flex items-center justify-center text-[12px] font-bold text-[#1CB0F6]">
                      {para.label}
                    </span>
                    <p className="text-[14px] leading-[1.85] text-gray-700">
                      {para.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right: Questions */}
          <section className="w-full lg:w-[420px] shrink-0">
            <div className="lg:sticky lg:top-[80px] space-y-4 max-h-[calc(100dvh-100px)] lg:overflow-y-auto rounded-2xl">
              {/* Progress bar */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-bold text-gray-500">作答進度</span>
                  <span className="text-[13px] font-bold text-[#58CC02]">
                    {answeredCount}/{allQuestions.length}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${allQuestions.length > 0 ? (answeredCount / allQuestions.length) * 100 : 0}%`,
                      backgroundColor: COLORS.green,
                    }}
                  />
                </div>
              </div>

              {/* Questions */}
              {currentPassage?.questions.map((q) => (
                <div
                  key={q.id}
                  ref={(el) => { questionRefs.current[q.id] = el; }}
                  className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)] transition-all hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]"
                >
                  <QuestionCard
                    question={q}
                    value={answers[q.id] ?? ""}
                    onChange={(v) => setAnswer(q.id, v)}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Mobile answer sheet toggle */}
      <button
        onClick={() => setShowAnswerSheet((v) => !v)}
        className="fixed bottom-6 right-6 z-40 lg:hidden rounded-2xl border-2 border-[#CE82FF] bg-[#CE82FF] px-4 py-3 text-[13px] font-bold text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.15)]"
      >
        答題卡
      </button>

      {/* Answer sheet overlay */}
      {showAnswerSheet && (
        <AnswerSheet
          passages={passages}
          answers={answers}
          activePassage={activePassage}
          onSelectPassage={setActivePassage}
          onSelectQuestion={scrollToQuestion}
          onClose={() => setShowAnswerSheet(false)}
        />
      )}
    </main>
  );
}

/* ================================================================== */
/*  QuestionCard                                                       */
/* ================================================================== */

function QuestionCard({
  question: q,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (v: string) => void;
}) {
  const typeBadge: Record<string, { label: string; color: string }> = {
    "true-false-not-given": { label: "T/F/NG", color: COLORS.blue },
    "matching-headings": { label: "配對標題", color: COLORS.purple },
    "fill-in-blank": { label: "填空", color: COLORS.yellow },
    "multiple-choice": { label: "選擇", color: COLORS.green },
    "sentence-completion": { label: "句子完成", color: COLORS.coral },
  };

  const badge = typeBadge[q.type] ?? { label: q.type, color: COLORS.blue };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-[13px] font-bold text-gray-600">
          {q.number}
        </span>
        <div className="flex-1 min-w-0">
          <span
            className="inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold text-white mb-1.5"
            style={{ backgroundColor: badge.color }}
          >
            {badge.label}
          </span>
          <p className="text-[13px] font-bold leading-relaxed text-gray-800">{q.text}</p>
        </div>
      </div>

      {/* Input */}
      {q.type === "true-false-not-given" && (
        <div className="flex gap-2 pl-11">
          {["True", "False", "Not Given"].map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={[
                "rounded-2xl border-2 px-4 py-2 text-[12px] font-bold transition-all",
                value === opt
                  ? "bg-[#1CB0F6] text-white border-[#1CB0F6] shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-[#1CB0F6] hover:text-[#1CB0F6]",
              ].join(" ")}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.type === "matching-headings" && q.options && (
        <div className="space-y-1.5 pl-11">
          {q.options.map((opt) => {
            const optKey = opt.split(".")[0]?.trim() ?? opt;
            return (
              <button
                key={opt}
                onClick={() => onChange(optKey)}
                className={[
                  "w-full rounded-xl border-2 px-3 py-2 text-left text-[12px] font-bold transition-all",
                  value === optKey
                    ? "bg-[#CE82FF]/10 text-[#CE82FF] border-[#CE82FF] shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#CE82FF]/50",
                ].join(" ")}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "fill-in-blank" && (
        <div className="pl-11">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="輸入答案..."
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-[13px] font-bold text-gray-800 placeholder:text-gray-300 focus:border-[#FFD900] focus:outline-none transition-all shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]"
          />
        </div>
      )}

      {q.type === "multiple-choice" && q.options && (
        <div className="space-y-1.5 pl-11">
          {q.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={[
                "w-full rounded-xl border-2 px-3 py-2 text-left text-[12px] font-bold transition-all",
                value === opt
                  ? "bg-[#58CC02]/10 text-[#58CC02] border-[#58CC02] shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#58CC02]/50",
              ].join(" ")}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.type === "sentence-completion" && (
        <div className="pl-11">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="輸入答案..."
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-[13px] font-bold text-gray-800 placeholder:text-gray-300 focus:border-[#FF4B4B] focus:outline-none transition-all shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]"
          />
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  AnswerSheet                                                        */
/* ================================================================== */

function AnswerSheet({
  passages,
  answers,
  activePassage,
  onSelectPassage,
  onSelectQuestion,
  onClose,
}: {
  passages: Passage[];
  answers: Record<string, string>;
  activePassage: number;
  onSelectPassage: (i: number) => void;
  onSelectQuestion: (qId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-[90vw] max-w-md rounded-2xl border-2 border-[#CE82FF] bg-white p-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.15)] animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-800">答題卡</h3>
          <button
            onClick={onClose}
            className="rounded-xl border-2 border-gray-200 bg-white w-8 h-8 flex items-center justify-center text-[14px] font-bold text-gray-400 hover:border-[#FF4B4B] hover:text-[#FF4B4B] transition-all"
          >
            X
          </button>
        </div>

        {passages.map((p, pi) => (
          <div key={p.number} className="mb-5">
            <p className="text-[12px] font-bold text-gray-400 mb-2">Passage {p.number}</p>
            <div className="flex flex-wrap gap-2">
              {p.questions.map((q) => {
                const answered = (answers[q.id] ?? "").trim().length > 0;
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      onSelectPassage(pi);
                      onClose();
                      setTimeout(() => onSelectQuestion(q.id), 150);
                    }}
                    className={[
                      "w-9 h-9 rounded-xl border-2 text-[12px] font-bold transition-all flex items-center justify-center",
                      answered
                        ? "bg-[#58CC02]/15 text-[#58CC02] border-[#58CC02]/40"
                        : pi === activePassage
                          ? "bg-[#1CB0F6]/10 text-[#1CB0F6] border-[#1CB0F6]/30"
                          : "bg-gray-50 text-gray-400 border-gray-200",
                    ].join(" ")}
                  >
                    {q.number}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  ScoreScreen                                                        */
/* ================================================================== */

function ScoreScreen({
  result,
  allQuestions,
}: {
  result: ScoreResult;
  allQuestions: Question[];
}) {
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
  const elapsed = result.durationSec;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  const bandColor =
    result.band >= 7 ? COLORS.green : result.band >= 5.5 ? COLORS.yellow : COLORS.coral;

  return (
    <main className="min-h-dvh bg-[#F7F7F7] font-brand">
      {/* Header */}
      <header className="mx-auto max-w-4xl px-4 pt-8 pb-4">
        <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-bold text-gray-400 hover:text-[#58CC02] transition-all">
          &larr; 返回首頁
        </Link>
      </header>

      {/* Score card */}
      <section className="mx-auto max-w-4xl px-4 mb-8">
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-[6px_6px_0_0_rgba(0,0,0,0.1)] text-center">
          <p className="text-[14px] font-bold text-gray-400 mb-3">閱讀測驗成績</p>

          <div className="animate-score-pop">
            <span className="text-[56px] font-bold" style={{ color: bandColor }}>
              {result.band.toFixed(1).replace(/\.0$/, "")}
            </span>
            <span className="text-[20px] font-bold text-gray-300 ml-1">/9</span>
          </div>

          <div className="flex items-center justify-center gap-6 mt-6">
            <Stat label="答對" value={`${result.correct}/${result.total}`} color={COLORS.green} />
            <Stat label="正確率" value={`${pct}%`} color={COLORS.blue} />
            <Stat label="用時" value={`${mins}:${String(secs).padStart(2, "0")}`} color={COLORS.purple} />
          </div>

          {/* Band bar */}
          <div className="mt-6 mx-auto max-w-xs">
            <div className="h-4 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 animate-progress-fill"
                style={{
                  width: `${(result.band / 9) * 100}%`,
                  backgroundColor: bandColor,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Detailed results */}
      <section className="mx-auto max-w-4xl px-4 pb-12 space-y-4">
        <h3 className="text-[15px] font-bold text-gray-800">題目詳解</h3>
        {result.results.map((r) => {
          const q = allQuestions.find((x) => x.id === r.questionId);
          return (
            <div
              key={r.questionId}
              className={[
                "rounded-2xl border-2 p-5 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)] transition-all",
                r.isCorrect
                  ? "border-[#58CC02]/40 bg-[#58CC02]/5"
                  : "border-[#FF4B4B]/40 bg-[#FF4B4B]/5",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[13px] font-bold text-white",
                    r.isCorrect ? "bg-[#58CC02]" : "bg-[#FF4B4B]",
                  ].join(" ")}
                >
                  {q?.number ?? "?"}
                </span>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-[13px] font-bold text-gray-800">{q?.text}</p>
                  <div className="flex flex-wrap gap-3 text-[12px] font-bold">
                    <span className="rounded-lg bg-gray-100 px-2 py-1 text-gray-500">
                      你的答案: <span className={r.isCorrect ? "text-[#58CC02]" : "text-[#FF4B4B]"}>{r.userAnswer || "(未作答)"}</span>
                    </span>
                    {!r.isCorrect && (
                      <span className="rounded-lg bg-[#58CC02]/10 px-2 py-1 text-[#58CC02]">
                        正確答案: {r.correctAnswer}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed text-gray-500 mt-1">
                    {r.explanation}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

/* ================================================================== */
/*  Stat pill (for score screen)                                       */
/* ================================================================== */

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[12px] font-bold text-gray-400">{label}</p>
      <p className="text-[20px] font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
