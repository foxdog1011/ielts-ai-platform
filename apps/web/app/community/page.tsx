"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type {
  CommunityQuestion,
  QuestionType,
  SortOption,
  CommunityApiResponse,
  CreateQuestionInput,
} from "@/features/community/types";

const TABS: readonly { value: QuestionType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" },
];

const SORTS: readonly { value: SortOption; label: string }[] = [
  { value: "popular", label: "\u71B1\u9580" },
  { value: "newest", label: "\u6700\u65B0" },
  { value: "highest", label: "\u9AD8\u5206" },
];

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  hard: "bg-red-50 text-red-700 border-red-200",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const TYPE_STYLES: Record<string, string> = {
  writing: "bg-blue-50 text-blue-700 border-blue-200",
  speaking: "bg-amber-50 text-amber-700 border-amber-200",
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function CommunityPage() {
  const [tab, setTab] = useState<QuestionType>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [questions, setQuestions] = useState<readonly CommunityQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (tab !== "all") params.set("type", tab);
      const res = await fetch(`/api/community?${params.toString()}`);
      const json: CommunityApiResponse<CommunityQuestion[]> = await res.json();
      if (json.success && json.data) {
        setQuestions(json.data);
      }
    } catch {
      // Silently handle fetch errors — list stays empty
    } finally {
      setLoading(false);
    }
  }, [tab, sort]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const input: CreateQuestionInput = {
      type: fd.get("type") as "writing" | "speaking",
      title: (fd.get("title") as string).trim(),
      prompt: (fd.get("prompt") as string).trim(),
      difficulty: fd.get("difficulty") as "easy" | "medium" | "hard",
      tips: (fd.get("tips") as string)?.trim() || undefined,
      authorName: (fd.get("authorName") as string).trim(),
    };

    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json: CommunityApiResponse<CommunityQuestion> = await res.json();

      if (!json.success) {
        setSubmitError(json.error ?? "Submission failed.");
      } else {
        setSubmitSuccess(true);
        form.reset();
        setTimeout(() => {
          setShowForm(false);
          setSubmitSuccess(false);
        }, 1500);
        fetchQuestions();
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-[var(--bg)] text-[var(--text)] font-brand">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--text-muted)] hover:text-[var(--color-primary)] theme-transition mb-6"
        >
          &larr; Back
        </Link>

        {/* Header */}
        <header className="animate-fade-up">
          <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight">
            {"\u793E\u7FA4\u984C\u5EAB"}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)] max-w-2xl">
            {"\u7531\u793E\u7FA4\u6210\u54E1\u51FA\u984C\uFF0C\u5927\u5BB6\u4E00\u8D77\u7DF4\u7FD2\u3002\u50CF Strava \u7684 Segments \u4E00\u6A23\u2014\u2014\u4F60\u51FA\u984C\uFF0C\u5225\u4EBA\u7DF4\u7FD2\uFF0C\u4E92\u76F8\u9032\u6B65\u3002"}
          </p>
        </header>

        {/* Controls */}
        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-up animate-fade-up-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tab filter */}
            <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-[13px] font-medium theme-transition",
                    tab === t.value
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSort(s.value)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-[13px] font-medium theme-transition",
                    sort === s.value
                      ? "bg-[var(--color-primary-50)] text-[var(--color-primary)] border border-[var(--color-primary-200)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="btn-primary flex items-center gap-1.5 min-h-[44px]"
          >
            {showForm ? "\u53D6\u6D88" : "\u6211\u8981\u51FA\u984C"}
          </button>
        </div>

        {/* Submit form (collapsible) */}
        {showForm && (
          <div className="mt-6 glass-card p-6 animate-fade-up">
            <h2 className="text-[16px] font-semibold mb-4">
              {"\u63D0\u4EA4\u65B0\u984C\u76EE"}
            </h2>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] text-[var(--text-secondary)] mb-1 block">
                  {"\u986F\u793A\u540D\u7A31"} *
                </span>
                <input
                  name="authorName"
                  required
                  maxLength={30}
                  placeholder="Your display name"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] focus-ring theme-transition"
                />
              </label>
              <div className="flex gap-3">
                <label className="block flex-1">
                  <span className="text-[13px] text-[var(--text-secondary)] mb-1 block">Type *</span>
                  <select
                    name="type"
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] focus-ring theme-transition"
                  >
                    <option value="writing">Writing</option>
                    <option value="speaking">Speaking</option>
                  </select>
                </label>
                <label className="block flex-1">
                  <span className="text-[13px] text-[var(--text-secondary)] mb-1 block">
                    {"\u96E3\u5EA6"} *
                  </span>
                  <select
                    name="difficulty"
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] focus-ring theme-transition"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>
              <label className="block sm:col-span-2">
                <span className="text-[13px] text-[var(--text-secondary)] mb-1 block">
                  {"\u984C\u76EE\u6A19\u984C"} *
                </span>
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="e.g. Should governments invest more in public transport?"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] focus-ring theme-transition"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[13px] text-[var(--text-secondary)] mb-1 block">
                  Prompt *
                </span>
                <textarea
                  name="prompt"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  placeholder="Full question prompt for the candidate..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] focus-ring theme-transition resize-y"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[13px] text-[var(--text-secondary)] mb-1 block">
                  Tips ({"\u9078\u586B"})
                </span>
                <input
                  name="tips"
                  maxLength={500}
                  placeholder="Any tips or notes for this question..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] focus-ring theme-transition"
                />
              </label>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "\u63D0\u4EA4\u4E2D..." : "\u63D0\u4EA4\u984C\u76EE"}
                </button>
                {submitError && (
                  <span className="text-[13px] text-[var(--color-error)]">{submitError}</span>
                )}
                {submitSuccess && (
                  <span className="text-[13px] text-[var(--color-success)]">
                    {"\u63D0\u4EA4\u6210\u529F\uFF01"}
                  </span>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Question grid */}
        <section className="mt-8 animate-fade-up animate-fade-up-2">
          {loading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card-sm p-5 h-48 animate-shimmer" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-[16px] text-[var(--text-muted)]">
                {"\u9084\u6C92\u6709\u984C\u76EE\u3002\u4F86\u7576\u7B2C\u4E00\u500B\u51FA\u984C\u8005\u5427\uFF01"}
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary mt-4 min-h-[44px]"
              >
                {"\u6211\u8981\u51FA\u984C"}
              </button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {questions.map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* QuestionCard                                                        */
/* ------------------------------------------------------------------ */

function QuestionCard({ question }: { readonly question: CommunityQuestion }) {
  const practiceUrl =
    question.type === "writing"
      ? `/tasks/1/writing?prompt=${encodeURIComponent(question.prompt)}`
      : `/tasks/1/speaking?prompt=${encodeURIComponent(question.prompt)}`;

  return (
    <div className="glass-card-sm p-5 flex flex-col hover-lift theme-transition">
      {/* Top row: badges */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={[
            "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
            TYPE_STYLES[question.type],
          ].join(" ")}
        >
          {question.type === "writing" ? "Writing" : "Speaking"}
        </span>
        <span
          className={[
            "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
            DIFFICULTY_STYLES[question.difficulty],
          ].join(" ")}
        >
          {DIFFICULTY_LABELS[question.difficulty]}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-[var(--text)] line-clamp-2 mb-2">
        {question.title}
      </h3>

      {/* Prompt preview */}
      <p className="text-[12px] text-[var(--text-muted)] line-clamp-3 mb-4 flex-1">
        {question.prompt}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] mb-4">
        <span>{question.authorName}</span>
        <span className="text-[var(--border)]">|</span>
        <span>{question.practiceCount} {"\u7DF4\u7FD2"}</span>
        {question.avgScore !== null && (
          <>
            <span className="text-[var(--border)]">|</span>
            <span>Avg {question.avgScore.toFixed(1)}</span>
          </>
        )}
        <span className="ml-auto text-[var(--text-faint)]">{formatDate(question.createdAt)}</span>
      </div>

      {/* Tips */}
      {question.tips && (
        <p className="text-[11px] text-[var(--text-muted)] italic mb-3 border-l-2 border-[var(--border)] pl-2">
          {question.tips}
        </p>
      )}

      {/* Action */}
      <Link
        href={practiceUrl}
        className="btn-primary text-center text-[13px] min-h-[40px] flex items-center justify-center"
      >
        {"\u958B\u59CB\u7DF4\u7FD2"}
      </Link>
    </div>
  );
}
