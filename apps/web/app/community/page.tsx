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
  { value: "all", label: "全部" },
  { value: "writing", label: "寫作" },
  { value: "speaking", label: "口說" },
];

const SORTS: readonly { value: SortOption; label: string }[] = [
  { value: "popular", label: "🔥 熱門" },
  { value: "newest", label: "✨ 最新" },
  { value: "highest", label: "⭐ 高分" },
];

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-[#E8F5E9] text-[#58CC02] border-[#58CC02]",
  medium: "bg-[#FFF8E1] text-[#FFA000] border-[#FFD900]",
  hard: "bg-[#FFEBEE] text-[#FF4B4B] border-[#FF4B4B]",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "簡單",
  medium: "中等",
  hard: "困難",
};

const TYPE_STYLES: Record<string, string> = {
  writing: "bg-[#E3F2FD] text-[#1CB0F6] border-[#1CB0F6]",
  speaking: "bg-[#F3E5F5] text-[#CE82FF] border-[#CE82FF]",
};

const TYPE_LABELS: Record<string, string> = {
  writing: "✍️ 寫作",
  speaking: "🗣️ 口說",
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
        setSubmitError(json.error ?? "提交失敗，請再試一次。");
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
      setSubmitError("網路錯誤，請再試一次。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-[#F7F5FF] text-gray-800 font-brand">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#58CC02] transition-all mb-6 rounded-2xl border-2 border-gray-200 bg-white px-4 py-2 shadow-[3px_3px_0_0_rgba(0,0,0,0.08)] hover:border-[#58CC02]"
        >
          &larr; 首頁
        </Link>

        {/* Header */}
        <header>
          <div className="flex items-center gap-3">
            <span className="text-3xl">📚</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              社群題庫
            </h1>
          </div>
          <p className="mt-3 text-base leading-relaxed text-gray-500 max-w-2xl font-medium">
            由社群成員出題，大家一起練習。你出題，別人練習，互相進步！
          </p>
        </header>

        {/* Controls */}
        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tab filter — Duolingo pills */}
            <div className="flex items-center bg-gray-100 rounded-2xl p-1.5 gap-1">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-bold transition-all min-h-[40px]",
                    tab === t.value
                      ? "bg-[#58CC02] text-white shadow-[0_3px_0_0_#46A302]"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Sort pills */}
            <div className="flex items-center bg-gray-100 rounded-2xl p-1.5 gap-1">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSort(s.value)}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-bold transition-all min-h-[40px]",
                    sort === s.value
                      ? "bg-white text-[#1CB0F6] border-2 border-[#1CB0F6] shadow-[0_2px_0_0_#1CB0F6]"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-200 border-2 border-transparent",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowForm((prev) => !prev)}
            className={[
              "rounded-2xl px-6 py-3 text-sm font-bold min-h-[44px] transition-all",
              showForm
                ? "bg-[#FF4B4B] text-white shadow-[0_4px_0_0_#CC3C3C] hover:brightness-110"
                : "bg-[#58CC02] text-white shadow-[0_4px_0_0_#46A302] hover:brightness-110",
            ].join(" ")}
          >
            {showForm ? "✕ 取消" : "➕ 我要出題"}
          </button>
        </div>

        {/* Submit form (collapsible) */}
        {showForm && (
          <div className="mt-6 rounded-3xl bg-white border-2 border-gray-200 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] p-6">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
              <span>✏️</span> 提交新題目
            </h2>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-gray-500 mb-1.5 block font-bold">
                  顯示名稱 *
                </span>
                <input
                  name="authorName"
                  required
                  maxLength={30}
                  placeholder="你的暱稱"
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 font-medium focus:border-[#58CC02] focus:outline-none transition-all"
                />
              </label>
              <div className="flex gap-3">
                <label className="block flex-1">
                  <span className="text-sm text-gray-500 mb-1.5 block font-bold">類型 *</span>
                  <select
                    name="type"
                    required
                    className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 font-medium focus:border-[#58CC02] focus:outline-none transition-all"
                  >
                    <option value="writing">寫作</option>
                    <option value="speaking">口說</option>
                  </select>
                </label>
                <label className="block flex-1">
                  <span className="text-sm text-gray-500 mb-1.5 block font-bold">
                    難度 *
                  </span>
                  <select
                    name="difficulty"
                    required
                    className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 font-medium focus:border-[#58CC02] focus:outline-none transition-all"
                  >
                    <option value="easy">簡單</option>
                    <option value="medium">中等</option>
                    <option value="hard">困難</option>
                  </select>
                </label>
              </div>
              <label className="block sm:col-span-2">
                <span className="text-sm text-gray-500 mb-1.5 block font-bold">
                  題目標題 *
                </span>
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="例：政府是否應該增加公共交通投資？"
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 font-medium focus:border-[#58CC02] focus:outline-none transition-all"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm text-gray-500 mb-1.5 block font-bold">
                  題目內容 *
                </span>
                <textarea
                  name="prompt"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  placeholder="完整的題目描述..."
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 font-medium focus:border-[#58CC02] focus:outline-none transition-all resize-y"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm text-gray-500 mb-1.5 block font-bold">
                  提示（選填）
                </span>
                <input
                  name="tips"
                  maxLength={500}
                  placeholder="給其他練習者的建議..."
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 font-medium focus:border-[#58CC02] focus:outline-none transition-all"
                />
              </label>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-[#58CC02] text-white px-6 py-3 text-sm font-bold min-h-[44px] shadow-[0_4px_0_0_#46A302] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "提交中..." : "🚀 提交題目"}
                </button>
                {submitError && (
                  <span className="text-sm text-[#FF4B4B] font-bold">{submitError}</span>
                )}
                {submitSuccess && (
                  <span className="text-sm text-[#58CC02] font-bold">
                    提交成功！
                  </span>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Question grid */}
        <section className="mt-8">
          {loading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-3xl bg-white border-2 border-gray-100 p-5 h-52 animate-pulse"
                />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-3xl bg-white border-2 border-gray-200 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] p-12 text-center">
              <span className="text-5xl block mb-4">🌟</span>
              <p className="text-lg text-gray-400 font-bold">
                還沒有題目。來當第一個出題者吧！
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="rounded-2xl bg-[#58CC02] text-white px-6 py-3 text-sm font-bold mt-5 min-h-[44px] shadow-[0_4px_0_0_#46A302] hover:brightness-110 transition-all"
              >
                ➕ 我要出題
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
    <div className="rounded-3xl bg-white border-2 border-gray-200 p-5 flex flex-col hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all">
      {/* Top row: badges */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={[
            "rounded-xl border-2 px-2.5 py-1 text-xs font-bold",
            TYPE_STYLES[question.type],
          ].join(" ")}
        >
          {TYPE_LABELS[question.type]}
        </span>
        <span
          className={[
            "rounded-xl border-2 px-2.5 py-1 text-xs font-bold",
            DIFFICULTY_STYLES[question.difficulty],
          ].join(" ")}
        >
          {DIFFICULTY_LABELS[question.difficulty]}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-gray-800 line-clamp-2 mb-2">
        {question.title}
      </h3>

      {/* Prompt preview */}
      <p className="text-xs text-gray-400 line-clamp-3 mb-4 flex-1 font-medium">
        {question.prompt}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4 font-bold flex-wrap">
        <span className="bg-gray-100 px-2 py-0.5 rounded-lg">{question.authorName}</span>
        <span className="bg-gray-100 px-2 py-0.5 rounded-lg">{question.practiceCount} 次練習</span>
        {question.avgScore !== null && (
          <span className="bg-[#FFF3E0] text-[#FF9800] px-2 py-0.5 rounded-lg">
            平均 {question.avgScore.toFixed(1)}
          </span>
        )}
        <span className="ml-auto text-gray-300">{formatDate(question.createdAt)}</span>
      </div>

      {/* Tips */}
      {question.tips && (
        <p className="text-xs text-gray-400 italic mb-3 border-l-4 border-[#FFD900] pl-3 bg-[#FFFDE7] py-1.5 rounded-r-xl font-medium">
          💡 {question.tips}
        </p>
      )}

      {/* Action */}
      <Link
        href={practiceUrl}
        className="rounded-2xl bg-[#1CB0F6] text-white text-center text-sm font-bold min-h-[44px] flex items-center justify-center shadow-[0_4px_0_0_#1899D6] hover:brightness-110 transition-all"
      >
        開始練習
      </Link>
    </div>
  );
}
