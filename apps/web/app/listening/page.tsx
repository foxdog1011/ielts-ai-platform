"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Option {
  label: string;
  text: string;
}

interface MatchItem {
  left: string;
  options: string[];
  correctAnswer: string;
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

interface ResultDetail {
  questionId: string;
  number: number;
  correct: boolean;
  userAnswer: string | Record<string, string>;
  correctAnswer: string | Record<string, string>;
}

interface SubmitResult {
  totalQuestions: number;
  totalCorrect: number;
  band: number;
  details: ResultDetail[];
  submittedAt: string;
}

type PlaybackSpeed = 0.75 | 1 | 1.25;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SECTION_COLORS: Record<number, { bg: string; border: string; text: string; activeBg: string }> = {
  0: { bg: "bg-[#58CC02]/10", border: "border-[#58CC02]", text: "text-[#58CC02]", activeBg: "bg-[#58CC02]" },
  1: { bg: "bg-[#1CB0F6]/10", border: "border-[#1CB0F6]", text: "text-[#1CB0F6]", activeBg: "bg-[#1CB0F6]" },
  2: { bg: "bg-[#CE82FF]/10", border: "border-[#CE82FF]", text: "text-[#CE82FF]", activeBg: "bg-[#CE82FF]" },
  3: { bg: "bg-[#FFD900]/10", border: "border-[#FFD900]", text: "text-[#B8960F]", activeBg: "bg-[#FFD900]" },
};

const TOTAL_TIME_SECONDS = 30 * 60; // 30 minutes

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ListeningPage() {
  const [sections, setSections] = useState<readonly Section[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio simulation
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mobile answer sheet
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);

  /* ---- Fetch data ---- */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/listening");
        const json = await res.json();
        if (json.success) {
          setSections(json.data);
        } else {
          setError(json.error ?? "無法載入題目");
        }
      } catch {
        setError("網路錯誤，無法載入題目");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ---- Timer ---- */
  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timeLeft]);

  /* ---- Auto-scroll simulation ---- */
  useEffect(() => {
    if (isPlaying) {
      const incrementPerTick = playbackSpeed * 0.5; // speed-adjusted
      scrollRef.current = setInterval(() => {
        setScrollProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return Math.min(100, prev + incrementPerTick);
        });
      }, 200);
    }
    return () => {
      if (scrollRef.current) clearInterval(scrollRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  /* ---- Handlers ---- */
  const handleStartExam = useCallback(() => {
    setTimerRunning(true);
    setIsPlaying(true);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
    if (!timerRunning) setTimerRunning(true);
  }, [timerRunning]);

  const cycleSpeed = useCallback(() => {
    setPlaybackSpeed((prev) => {
      if (prev === 0.75) return 1;
      if (prev === 1) return 1.25;
      return 0.75;
    });
  }, []);

  const handleSectionChange = useCallback((idx: number) => {
    setActiveSection(idx);
    setScrollProgress(0);
    setIsPlaying(false);
  }, []);

  const handleAnswer = useCallback((questionId: string, value: string | Record<string, string>) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleMatchAnswer = useCallback((questionId: string, left: string, value: string) => {
    setAnswers((prev) => {
      const existing = (prev[questionId] as Record<string, string>) ?? {};
      return { ...prev, [questionId]: { ...existing, [left]: value } };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/listening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setTimerRunning(false);
        setIsPlaying(false);
      } else {
        setError(json.error ?? "提交失敗");
      }
    } catch {
      setError("網路錯誤，提交失敗");
    } finally {
      setSubmitting(false);
    }
  }, [answers]);

  /* ---- Derived ---- */
  const currentSection = sections[activeSection] as Section | undefined;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timerColor = timeLeft < 300 ? "text-[#FF4B4B]" : "text-gray-800";

  /* ---- Loading / Error ---- */
  if (loading) {
    return (
      <main className="min-h-dvh bg-[#F7F7F7] flex items-center justify-center font-brand">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-[#58CC02] border-t-transparent" />
          <p className="mt-4 text-[14px] font-bold text-gray-500">載入聽力題目中...</p>
        </div>
      </main>
    );
  }

  if (error && !result) {
    return (
      <main className="min-h-dvh bg-[#F7F7F7] flex items-center justify-center font-brand">
        <div className="rounded-2xl border-2 border-[#FF4B4B] bg-white p-8 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
          <p className="text-[16px] font-bold text-[#FF4B4B]">{error}</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-[#58CC02] px-6 py-3 text-[14px] font-bold text-white shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]">
            返回首頁
          </Link>
        </div>
      </main>
    );
  }

  /* ---- Result screen ---- */
  if (result) {
    return <ResultScreen result={result} sections={sections} onBack={() => setResult(null)} />;
  }

  return (
    <main className="min-h-dvh bg-[#F7F7F7] font-brand">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-30 border-b-2 border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="h-9 w-9 rounded-xl bg-[#58CC02] flex items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]">
              <span className="text-white text-[11px] font-bold">AI</span>
            </Link>
            <h1 className="text-[16px] font-bold tracking-tight">IELTS 聽力模擬</h1>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-3">
            <div className={`rounded-xl border-2 border-gray-200 bg-white px-4 py-2 font-mono text-[16px] font-bold ${timerColor} shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]`}>
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            {!timerRunning && timeLeft === TOTAL_TIME_SECONDS && (
              <button
                onClick={handleStartExam}
                className="rounded-xl bg-[#58CC02] px-5 py-2.5 text-[13px] font-bold text-white shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] hover:bg-[#4CAF00] transition-all active:scale-[0.97]"
              >
                開始考試
              </button>
            )}
            {/* Mobile answer sheet toggle */}
            <button
              onClick={() => setShowAnswerSheet((v) => !v)}
              className="lg:hidden rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-[13px] font-bold shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]"
            >
              📋
            </button>
          </div>
        </div>
      </header>

      {/* ---- Section pills ---- */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sections.map((sec, idx) => {
            const color = SECTION_COLORS[idx] ?? SECTION_COLORS[0]!;
            const isActive = idx === activeSection;
            return (
              <button
                key={sec.id}
                onClick={() => handleSectionChange(idx)}
                className={[
                  "shrink-0 rounded-2xl border-2 px-5 py-2.5 text-[13px] font-bold transition-all active:scale-[0.97]",
                  isActive
                    ? `${color.activeBg} text-white ${color.border} shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]`
                    : `${color.bg} ${color.text} ${color.border} shadow-[2px_2px_0_0_rgba(0,0,0,0.05)] hover:shadow-[3px_3px_0_0_rgba(0,0,0,0.1)]`,
                ].join(" ")}
              >
                Section {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Content ---- */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-8 flex gap-6">
        {/* Left: transcript + questions */}
        <div className="flex-1 min-w-0 space-y-5">
          {currentSection && (
            <>
              {/* Section info */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                <h2 className="text-[15px] font-bold text-gray-800 mb-1">{currentSection.title}</h2>
                <p className="text-[13px] text-gray-500 font-medium">{currentSection.description}</p>
              </div>

              {/* Audio player UI */}
              <AudioPlayer
                isPlaying={isPlaying}
                progress={scrollProgress}
                speed={playbackSpeed}
                onPlayPause={handlePlayPause}
                onCycleSpeed={cycleSpeed}
                onSeek={setScrollProgress}
                disabled={!timerRunning}
              />

              {/* Transcript */}
              <TranscriptViewer
                transcript={currentSection.transcript}
                progress={scrollProgress}
              />

              {/* Questions */}
              <div className="space-y-4">
                <h3 className="text-[15px] font-bold text-gray-800">
                  題目 {currentSection.questions[0]?.number} - {currentSection.questions[currentSection.questions.length - 1]?.number}
                </h3>
                {currentSection.questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    answer={answers[q.id]}
                    onAnswer={handleAnswer}
                    onMatchAnswer={handleMatchAnswer}
                    disabled={!timerRunning && timeLeft === TOTAL_TIME_SECONDS}
                  />
                ))}
              </div>

              {/* Submit button */}
              <div className="pt-4 pb-8">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full rounded-2xl bg-[#58CC02] py-4 text-[16px] font-bold text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] hover:bg-[#4CAF00] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "提交中..." : "提交答案"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Answer sheet (desktop) */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20">
            <AnswerSheet
              sections={sections}
              answers={answers}
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
            />
          </div>
        </div>
      </div>

      {/* Mobile answer sheet (bottom sheet) */}
      {showAnswerSheet && (
        <MobileBottomSheet onClose={() => setShowAnswerSheet(false)}>
          <AnswerSheet
            sections={sections}
            answers={answers}
            activeSection={activeSection}
            onSectionChange={(idx) => {
              handleSectionChange(idx);
              setShowAnswerSheet(false);
            }}
          />
        </MobileBottomSheet>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  AudioPlayer                                                        */
/* ------------------------------------------------------------------ */

function AudioPlayer({
  isPlaying,
  progress,
  speed,
  onPlayPause,
  onCycleSpeed,
  onSeek,
  disabled,
}: {
  isPlaying: boolean;
  progress: number;
  speed: PlaybackSpeed;
  onPlayPause: () => void;
  onCycleSpeed: () => void;
  onSeek: (val: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        <button
          onClick={onPlayPause}
          disabled={disabled}
          className="h-12 w-12 shrink-0 rounded-2xl bg-[#1CB0F6] flex items-center justify-center text-white shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] hover:bg-[#1899D6] transition-all active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-[18px]">{isPlaying ? "⏸" : "▶"}</span>
        </button>

        {/* Progress bar */}
        <div className="flex-1 min-w-0">
          <div
            className="relative h-3 w-full rounded-full bg-gray-100 cursor-pointer"
            onClick={(e) => {
              if (disabled) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
              onSeek(pct);
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#1CB0F6] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white border-2 border-[#1CB0F6] shadow-sm transition-all duration-200"
              style={{ left: `calc(${progress}% - 10px)` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[11px] font-bold text-gray-400">模擬播放中</span>
            <span className="text-[11px] font-bold text-gray-400">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Speed */}
        <button
          onClick={onCycleSpeed}
          disabled={disabled}
          className="shrink-0 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-gray-600 shadow-[2px_2px_0_0_rgba(0,0,0,0.05)] hover:border-[#1CB0F6] hover:text-[#1CB0F6] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TranscriptViewer                                                    */
/* ------------------------------------------------------------------ */

function TranscriptViewer({ transcript, progress }: { transcript: string; progress: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lines = transcript.split("\n").filter((l) => l.trim());
  const visibleCount = Math.max(1, Math.ceil((progress / 100) * lines.length));

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleCount]);

  return (
    <div className="rounded-2xl border-2 border-[#1CB0F6]/30 bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
      <div className="px-5 py-3 border-b-2 border-gray-100 flex items-center gap-2">
        <span className="text-[14px]">📝</span>
        <span className="text-[13px] font-bold text-gray-800">逐字稿（模擬模式）</span>
      </div>
      <div
        ref={containerRef}
        className="px-5 py-4 max-h-64 overflow-y-auto scroll-smooth space-y-2"
      >
        {lines.slice(0, visibleCount).map((line, i) => {
          const isNew = i === visibleCount - 1;
          return (
            <p
              key={i}
              className={[
                "text-[13px] leading-relaxed transition-opacity duration-500",
                isNew ? "font-bold text-gray-800" : "text-gray-500",
              ].join(" ")}
            >
              {line}
            </p>
          );
        })}
        {progress < 100 && visibleCount < lines.length && (
          <p className="text-[13px] text-gray-300 animate-pulse">...</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  QuestionCard                                                       */
/* ------------------------------------------------------------------ */

function QuestionCard({
  question,
  answer,
  onAnswer,
  onMatchAnswer,
  disabled,
}: {
  question: Question;
  answer?: string | Record<string, string>;
  onAnswer: (id: string, val: string | Record<string, string>) => void;
  onMatchAnswer: (id: string, left: string, val: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)] hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] transition-all">
      <div className="flex items-start gap-3 mb-3">
        <span className="shrink-0 h-8 w-8 rounded-xl bg-[#58CC02] flex items-center justify-center text-[12px] font-bold text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">
          {question.number}
        </span>
        <p className="text-[14px] font-bold text-gray-800 leading-relaxed">{question.text}</p>
      </div>

      {question.type === "multiple-choice" && question.options && (
        <div className="space-y-2 ml-11">
          {question.options.map((opt) => {
            const isSelected = answer === opt.label;
            return (
              <button
                key={opt.label}
                onClick={() => !disabled && onAnswer(question.id, opt.label)}
                disabled={disabled}
                className={[
                  "w-full text-left rounded-xl border-2 px-4 py-3 text-[13px] font-bold transition-all active:scale-[0.98]",
                  isSelected
                    ? "border-[#58CC02] bg-[#58CC02]/10 text-[#58CC02] shadow-[2px_2px_0_0_rgba(88,204,2,0.2)]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]",
                  disabled ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <span className="mr-2">{opt.label}.</span>
                {opt.text}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "fill-in-blank" && (
        <div className="ml-11">
          <input
            type="text"
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => onAnswer(question.id, e.target.value)}
            disabled={disabled}
            placeholder="在此輸入答案..."
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-[13px] font-bold text-gray-800 placeholder:text-gray-300 focus:border-[#1CB0F6] focus:outline-none shadow-[2px_2px_0_0_rgba(0,0,0,0.05)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      )}

      {question.type === "matching" && question.matchItems && (
        <div className="ml-11 space-y-3">
          {question.matchItems.map((item) => {
            const currentAnswer = typeof answer === "object" ? (answer as Record<string, string>)[item.left] : undefined;
            return (
              <div key={item.left} className="space-y-1.5">
                <p className="text-[12px] font-bold text-gray-500">{item.left}</p>
                <div className="flex flex-wrap gap-2">
                  {item.options.map((opt) => {
                    const isSelected = currentAnswer === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => !disabled && onMatchAnswer(question.id, item.left, opt)}
                        disabled={disabled}
                        className={[
                          "rounded-xl border-2 px-3 py-2 text-[12px] font-bold transition-all active:scale-[0.97]",
                          isSelected
                            ? "border-[#CE82FF] bg-[#CE82FF]/10 text-[#CE82FF] shadow-[2px_2px_0_0_rgba(206,130,255,0.2)]"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]",
                          disabled ? "opacity-50 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AnswerSheet                                                        */
/* ------------------------------------------------------------------ */

function AnswerSheet({
  sections,
  answers,
  activeSection,
  onSectionChange,
}: {
  sections: readonly Section[];
  answers: Record<string, string | Record<string, string>>;
  activeSection: number;
  onSectionChange: (idx: number) => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
      <div className="px-4 py-3 border-b-2 border-gray-100">
        <h3 className="text-[13px] font-bold text-gray-800">📋 答題卡</h3>
      </div>
      <div className="p-4 space-y-4">
        {sections.map((sec, sIdx) => {
          const color = SECTION_COLORS[sIdx] ?? SECTION_COLORS[0]!;
          return (
            <div key={sec.id}>
              <button
                onClick={() => onSectionChange(sIdx)}
                className={[
                  "w-full text-left rounded-xl px-3 py-2 text-[12px] font-bold mb-2 transition-all",
                  sIdx === activeSection
                    ? `${color.activeBg} text-white`
                    : `${color.bg} ${color.text} hover:opacity-80`,
                ].join(" ")}
              >
                Section {sIdx + 1}
              </button>
              <div className="grid grid-cols-5 gap-1.5">
                {sec.questions.map((q) => {
                  const hasAnswer = answers[q.id] !== undefined && answers[q.id] !== "";
                  return (
                    <div
                      key={q.id}
                      className={[
                        "h-8 w-full rounded-lg flex items-center justify-center text-[11px] font-bold border-2 transition-all",
                        hasAnswer
                          ? `${color.activeBg} text-white ${color.border}`
                          : "border-gray-200 bg-gray-50 text-gray-400",
                      ].join(" ")}
                    >
                      {q.number}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Answer count summary */}
        <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
          <span className="text-[12px] font-bold text-gray-500">
            已作答：{countAnswered(sections, answers)} / {countTotal(sections)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MobileBottomSheet                                                  */
/* ------------------------------------------------------------------ */

function MobileBottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[70dvh] overflow-y-auto rounded-t-2xl bg-[#F7F7F7] p-4 animate-[slideUp_0.3s_ease-out]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ResultScreen                                                       */
/* ------------------------------------------------------------------ */

function ResultScreen({
  result,
  sections,
  onBack,
}: {
  result: SubmitResult;
  sections: readonly Section[];
  onBack: () => void;
}) {
  const pct = Math.round((result.totalCorrect / result.totalQuestions) * 100);
  const bandColor = result.band >= 7 ? "#58CC02" : result.band >= 5.5 ? "#FFD900" : "#FF4B4B";

  return (
    <main className="min-h-dvh bg-[#F7F7F7] font-brand">
      <header className="mx-auto max-w-4xl px-4 sm:px-8 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="h-9 w-9 rounded-xl bg-[#58CC02] flex items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]">
            <span className="text-white text-[11px] font-bold">AI</span>
          </Link>
          <h1 className="text-[16px] font-bold tracking-tight">聽力測驗結果</h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 sm:px-8 pb-12 space-y-6">
        {/* Score card */}
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-8 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
          <div
            className="inline-flex h-28 w-28 items-center justify-center rounded-full border-4"
            style={{ borderColor: bandColor }}
          >
            <span className="text-4xl font-bold" style={{ color: bandColor }}>
              {result.band}
            </span>
          </div>
          <p className="mt-3 text-[14px] font-bold text-gray-500">IELTS 聽力分數</p>
          <div className="mt-4 flex justify-center gap-4">
            <div className="rounded-xl bg-gray-50 px-4 py-2">
              <span className="text-[12px] font-bold text-gray-400">答對</span>
              <p className="text-[18px] font-bold text-gray-800">{result.totalCorrect}/{result.totalQuestions}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-2">
              <span className="text-[12px] font-bold text-gray-400">正確率</span>
              <p className="text-[18px] font-bold text-gray-800">{pct}%</p>
            </div>
          </div>
        </div>

        {/* Detail per question */}
        {sections.map((sec, sIdx) => {
          const color = SECTION_COLORS[sIdx] ?? SECTION_COLORS[0]!;
          return (
            <div key={sec.id} className="rounded-2xl border-2 border-gray-200 bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] overflow-hidden">
              <div className={`px-5 py-3 ${color.bg}`}>
                <h3 className={`text-[14px] font-bold ${color.text}`}>{sec.title}</h3>
              </div>
              <div className="p-5 space-y-3">
                {sec.questions.map((q) => {
                  const detail = result.details.find((d) => d.questionId === q.id);
                  if (!detail) return null;
                  return (
                    <div
                      key={q.id}
                      className={[
                        "rounded-xl border-2 p-4 transition-all",
                        detail.correct
                          ? "border-[#58CC02]/30 bg-[#58CC02]/5"
                          : "border-[#FF4B4B]/30 bg-[#FF4B4B]/5",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <span className={[
                          "shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white",
                          detail.correct ? "bg-[#58CC02]" : "bg-[#FF4B4B]",
                        ].join(" ")}>
                          {detail.correct ? "✓" : "✗"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-800">
                            第 {q.number} 題：{q.text}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                            <span className={[
                              "rounded-lg px-2 py-1 font-bold",
                              detail.correct
                                ? "bg-[#58CC02]/10 text-[#58CC02]"
                                : "bg-[#FF4B4B]/10 text-[#FF4B4B]",
                            ].join(" ")}>
                              你的答案：{formatAnswer(detail.userAnswer)}
                            </span>
                            {!detail.correct && (
                              <span className="rounded-lg bg-[#58CC02]/10 px-2 py-1 font-bold text-[#58CC02]">
                                正確答案：{formatAnswer(detail.correctAnswer)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onBack}
            className="flex-1 rounded-2xl border-2 border-gray-200 bg-white py-4 text-[14px] font-bold text-gray-700 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)] hover:border-gray-300 transition-all active:scale-[0.98]"
          >
            重新作答
          </button>
          <Link
            href="/"
            className="flex-1 rounded-2xl bg-[#58CC02] py-4 text-center text-[14px] font-bold text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] hover:bg-[#4CAF00] transition-all active:scale-[0.98]"
          >
            返回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

function countAnswered(sections: readonly Section[], answers: Record<string, string | Record<string, string>>): number {
  let count = 0;
  for (const sec of sections) {
    for (const q of sec.questions) {
      const a = answers[q.id];
      if (a !== undefined && a !== "") count++;
    }
  }
  return count;
}

function countTotal(sections: readonly Section[]): number {
  return sections.reduce((sum, sec) => sum + sec.questions.length, 0);
}

function formatAnswer(answer: string | Record<string, string>): string {
  if (typeof answer === "string") return answer || "(未作答)";
  const entries = Object.entries(answer);
  if (entries.length === 0) return "(未作答)";
  return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
}
