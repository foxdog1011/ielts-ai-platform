"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RadarChart, type RadarDim } from "@/components/RadarChart";
import ShareScoreCard from "@/components/ShareScoreCard";

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
}

interface PastExamSummary {
  id: string;
  createdAt: string;
  overallBand: number | null;
  sectionScores: Partial<Record<SectionKey, SectionScore>>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SECTION_META: Record<SectionKey, { icon: string; label: string; color: string }> = {
  listening: { icon: "\�\�", label: "\聽\力", color: "#1CB0F6" },
  reading: { icon: "\�\�", label: "\閱\讀", color: "#58CC02" },
  writing: { icon: "\✍\️", label: "\寫\作", color: "#CE82FF" },
  speaking: { icon: "\�\�\️", label: "\口\說", color: "#FFD900" },
};

function fmtBand(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toFixed(1).replace(/\.0$/, "");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function bandToLevel(band: number): string {
  if (band >= 8) return "\專\家\級";
  if (band >= 7) return "\優\秀";
  if (band >= 6) return "\良\好";
  if (band >= 5) return "\基\礎";
  return "\需\加\強";
}

function bandToColor(band: number): string {
  if (band >= 7) return "#58CC02";
  if (band >= 6) return "#1CB0F6";
  if (band >= 5) return "#FFD900";
  return "#FF4B4B";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MockExamResults() {
  const params = useParams<{ id: string }>();
  const examId = params?.id ?? "";
  const router = useRouter();

  const [exam, setExam] = useState<MockExam | null>(null);
  const [pastExams, setPastExams] = useState<PastExamSummary[]>([]);
  const [error, setError] = useState("");

  /* ---- Load exam ---- */
  useEffect(() => {
    if (!examId) return;

    // Fetch current exam and all past exams in parallel
    Promise.all([
      fetch(`/api/mock-exam?id=${examId}`).then((r) => r.json()),
      fetch("/api/mock-exam").then((r) => r.json()),
    ])
      .then(([examJson, listJson]) => {
        if (examJson.ok && examJson.data) {
          setExam(examJson.data);
        } else {
          setError("\找\不\到\該\模\擬\考");
        }

        if (listJson.ok && Array.isArray(listJson.data)) {
          const completed = listJson.data
            .filter(
              (e: MockExam) => e.status === "completed" && e.id !== examId,
            )
            .slice(0, 5)
            .map((e: MockExam) => ({
              id: e.id,
              createdAt: e.createdAt,
              overallBand: e.overallBand,
              sectionScores: e.sectionScores,
            }));
          setPastExams(completed);
        }
      })
      .catch(() => setError("\網\路\錯\誤"));
  }, [examId]);

  /* ---- Retry exam ---- */
  const handleRetry = useCallback(async () => {
    if (!exam) return;
    try {
      const res = await fetch("/api/mock-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: exam.sections }),
      });
      const json = await res.json();
      if (json.ok && json.data?.id) {
        router.push(`/mock-exam/${json.data.id}`);
      }
    } catch {
      // silent
    }
  }, [exam, router]);

  /* ---- Loading / error ---- */
  if (error) {
    return (
      <main className="min-h-dvh bg-[#F7F7F7] font-brand flex items-center justify-center">
        <div className="rounded-2xl border-2 border-[#FF4B4B]/40 bg-white p-8 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
          <p className="text-[15px] font-bold text-[#FF4B4B] mb-4">{error}</p>
          <Link
            href="/mock-exam"
            className="rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-[13px] font-bold text-gray-600 hover:border-[#58CC02] transition-all shadow-[2px_2px_0_0_rgba(0,0,0,0.07)]"
          >
            \返\回\模\擬\考
          </Link>
        </div>
      </main>
    );
  }

  if (!exam) {
    return (
      <main className="min-h-dvh bg-[#F7F7F7] font-brand flex items-center justify-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#58CC02] border-t-transparent" />
      </main>
    );
  }

  /* ---- Compute data ---- */
  const sectionBands = exam.sections
    .map((key) => ({
      key,
      ...SECTION_META[key],
      band: exam.sectionScores[key]?.band ?? null,
    }));

  const radarDims: RadarDim[] = sectionBands.map((s) => ({
    label: s.label,
    value: s.band ?? 0,
  }));

  const overallBand = exam.overallBand;
  const overallColor = overallBand != null ? bandToColor(overallBand) : "#58CC02";
  const overallLevel = overallBand != null ? bandToLevel(overallBand) : "";

  // Find strongest / weakest
  const scoredSections = sectionBands.filter((s) => s.band != null);
  const strongest = scoredSections.length > 0
    ? scoredSections.reduce((a, b) => ((a.band ?? 0) >= (b.band ?? 0) ? a : b))
    : null;
  const weakest = scoredSections.length > 0
    ? scoredSections.reduce((a, b) => ((a.band ?? 0) <= (b.band ?? 0) ? a : b))
    : null;

  // Share score data
  const shareScores = sectionBands.map((s) => ({
    label: s.label,
    value: s.band,
  }));

  return (
    <main className="min-h-dvh bg-[#F7F7F7] font-brand text-gray-800">
      {/* Header */}
      <header className="mx-auto max-w-4xl px-4 sm:px-8 pt-8 pb-2">
        <Link
          href="/mock-exam"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-gray-400 hover:text-[#58CC02] transition-colors mb-4"
        >
          <span>&larr;</span> <span>\模\擬\考\列\表</span>
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-2xl bg-[#58CC02] flex items-center justify-center shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]">
            <span className="text-white text-lg font-bold">\�\�</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">\模\擬\考\結\果</h1>
            <p className="text-[13px] font-bold text-gray-400">{fmtDate(exam.createdAt)}</p>
          </div>
        </div>
      </header>

      {/* Overall band score */}
      <section className="mx-auto max-w-4xl px-4 sm:px-8 mt-4">
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] text-center">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            \整\體\分\數
          </p>
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span
              className="text-6xl font-bold tracking-tight"
              style={{ color: overallColor }}
            >
              {fmtBand(overallBand)}
            </span>
            <span className="text-lg font-bold text-gray-400">/ 9</span>
          </div>
          {overallLevel && (
            <span
              className="inline-block rounded-xl px-4 py-1.5 text-[13px] font-bold text-white"
              style={{ backgroundColor: overallColor }}
            >
              {overallLevel}
            </span>
          )}

          {/* Progress bar */}
          <div className="mt-6 h-4 w-full max-w-md mx-auto rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, ((overallBand ?? 0) / 9) * 100))}%`,
                backgroundColor: overallColor,
              }}
            />
          </div>
        </div>
      </section>

      {/* Per-section breakdown */}
      <section className="mx-auto max-w-4xl px-4 sm:px-8 mt-6">
        <h2 className="text-[15px] font-bold text-gray-800 mb-4">
          \各\部\分\成\績
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sectionBands.map((sec) => {
            const pct = sec.band != null ? Math.max(0, Math.min(100, (sec.band / 9) * 100)) : 0;
            return (
              <div
                key={sec.key}
                className="rounded-2xl border-2 bg-white p-5 shadow-[3px_3px_0_0_rgba(0,0,0,0.07)] transition-all hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]"
                style={{ borderColor: `${sec.color}40` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${sec.color}15` }}
                  >
                    <span className="text-lg">{sec.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-bold text-gray-800">{sec.label}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: sec.color }}
                    >
                      {fmtBand(sec.band)}
                    </span>
                    <span className="text-[12px] font-bold text-gray-400 ml-1">/ 9</span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: sec.color }}
                  />
                </div>
                {sec.band != null && (
                  <p className="mt-2 text-[11px] font-bold text-gray-400">
                    {bandToLevel(sec.band)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Radar chart */}
      {radarDims.length >= 3 && (
        <section className="mx-auto max-w-4xl px-4 sm:px-8 mt-6">
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
            <h2 className="text-[15px] font-bold text-gray-800 mb-4">
              \�\� \能\力\雷\達\圖
            </h2>
            <div className="flex justify-center">
              <RadarChart dims={radarDims} max={9} size={280} color={overallColor} />
            </div>
            {strongest && weakest && strongest.key !== weakest.key && (
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <span className="rounded-xl bg-[#58CC02]/10 px-3 py-1.5 text-[12px] font-bold text-[#58CC02]">
                  \↑ \最\強: {strongest.label} ({fmtBand(strongest.band)})
                </span>
                <span className="rounded-xl bg-[#FF4B4B]/10 px-3 py-1.5 text-[12px] font-bold text-[#FF4B4B]">
                  \↓ \待\加\強: {weakest.label} ({fmtBand(weakest.band)})
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Comparison with past exams */}
      {pastExams.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 sm:px-8 mt-6">
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
            <h2 className="text-[15px] font-bold text-gray-800 mb-4">
              \�\� \與\過\去\模\擬\考\比\較
            </h2>
            <div className="space-y-3">
              {/* Current exam row (highlighted) */}
              <div className="flex items-center gap-3 rounded-xl border-2 border-[#58CC02]/40 bg-[#58CC02]/5 px-4 py-3">
                <span className="rounded-lg bg-[#58CC02] px-2 py-0.5 text-[10px] font-bold text-white">
                  \本\次
                </span>
                <span className="text-[12px] font-bold text-gray-500 flex-shrink-0">
                  {fmtDate(exam.createdAt)}
                </span>
                <div className="flex-1 flex flex-wrap gap-2">
                  {sectionBands.map((s) => (
                    <span
                      key={s.key}
                      className="text-[11px] font-bold text-gray-500"
                    >
                      {s.icon} {fmtBand(s.band)}
                    </span>
                  ))}
                </div>
                <span className="text-lg font-bold" style={{ color: overallColor }}>
                  {fmtBand(overallBand)}
                </span>
              </div>

              {/* Past exam rows */}
              {pastExams.map((past) => {
                const pastColor = past.overallBand != null ? bandToColor(past.overallBand) : "#999";
                return (
                  <Link
                    key={past.id}
                    href={`/mock-exam/${past.id}/results`}
                    className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 hover:border-gray-300 transition-all"
                  >
                    <span className="text-[12px] font-bold text-gray-400 flex-shrink-0">
                      {fmtDate(past.createdAt)}
                    </span>
                    <div className="flex-1 flex flex-wrap gap-2">
                      {(["listening", "reading", "writing", "speaking"] as SectionKey[]).map((key) => {
                        const meta = SECTION_META[key];
                        const score = past.sectionScores[key];
                        if (!score) return null;
                        return (
                          <span
                            key={key}
                            className="text-[11px] font-bold text-gray-400"
                          >
                            {meta.icon} {fmtBand(score.band)}
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-lg font-bold" style={{ color: pastColor }}>
                      {fmtBand(past.overallBand)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Share card */}
      <section className="mx-auto max-w-4xl px-4 sm:px-8 mt-6">
        <ShareScoreCard
          type="writing"
          overall={overallBand}
          scores={shareScores}
          date={fmtDate(exam.createdAt)}
        />
      </section>

      {/* Action buttons */}
      <section className="mx-auto max-w-4xl px-4 sm:px-8 mt-6 pb-12">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetry}
            className="flex-1 rounded-2xl border-2 border-[#58CC02] bg-[#58CC02] px-6 py-4 text-[15px] font-bold text-white transition-all hover:bg-[#4CAD02] shadow-[0_5px_0_0_#3D8C01] active:shadow-[0_2px_0_0_#3D8C01] active:translate-y-[3px]"
          >
            \再\考\一\次 \�\�
          </button>
          <Link
            href="/goals"
            className="flex-1 rounded-2xl border-2 border-[#CE82FF] bg-[#F5EEFF] px-6 py-4 text-center text-[15px] font-bold text-[#7B2FBE] transition-all hover:bg-[#EDE0FF] shadow-[0_5px_0_0_#CE82FF] active:shadow-[0_2px_0_0_#CE82FF] active:translate-y-[3px]"
          >
            \查\看\建\議 \�\�
          </Link>
          <Link
            href="/mock-exam"
            className="flex-1 rounded-2xl border-2 border-gray-200 bg-white px-6 py-4 text-center text-[15px] font-bold text-gray-600 transition-all hover:bg-gray-50 hover:border-gray-300 shadow-[0_5px_0_0_rgba(0,0,0,0.07)] active:shadow-[0_2px_0_0_rgba(0,0,0,0.07)] active:translate-y-[3px]"
          >
            \返\回\列\表
          </Link>
        </div>
      </section>
    </main>
  );
}
