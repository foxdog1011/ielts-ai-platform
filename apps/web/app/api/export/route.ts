// apps/web/app/api/export/route.ts
// GET /api/export?type=writing|speaking|all
// Returns a UTF-8 CSV with BOM for Excel compatibility.

import { NextRequest, NextResponse } from "next/server";
import { listHistory, type HistoryRecord, type WritingRecord, type SpeakingRecord } from "@/lib/history";

function fmtDate(rec: HistoryRecord): string {
  const ts = (rec as any).ts ?? (rec.createdAt ? Date.parse(rec.createdAt) : null);
  if (!ts) return "";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}

function escapeCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writingRows(records: WritingRecord[]): string {
  const header = ["日期", "題目", "字數", "時長(s)", "Overall", "Task", "Coherence", "Lexical", "Grammar"];
  const rows = records.map((r) => [
    fmtDate(r),
    r.prompt ?? "",
    r.words ?? "",
    r.durationSec ?? "",
    r.band?.overall ?? "",
    r.band?.taskResponse ?? "",
    r.band?.coherence ?? "",
    r.band?.lexical ?? "",
    r.band?.grammar ?? "",
  ].map(escapeCell).join(","));
  return [header.join(","), ...rows].join("\r\n");
}

function speakingRows(records: SpeakingRecord[]): string {
  const header = ["日期", "題目", "時長(s)", "Overall", "Content", "Grammar", "Vocab", "Fluency", "Pronunciation"];
  const rows = records.map((r) => [
    fmtDate(r),
    r.prompt ?? "",
    r.durationSec ?? "",
    r.band?.overall ?? "",
    r.band?.content ?? "",
    r.band?.grammar ?? "",
    r.band?.vocab ?? "",
    r.band?.fluency ?? "",
    r.band?.pronunciation ?? "",
  ].map(escapeCell).join(","));
  return [header.join(","), ...rows].join("\r\n");
}

export async function GET(req: NextRequest) {
  const typeParam = new URL(req.url).searchParams.get("type") ?? "all";
  const type: "writing" | "speaking" | "all" =
    typeParam === "writing" || typeParam === "speaking" ? typeParam : "all";

  const [writingRecs, speakingRecs] = await Promise.all([
    type !== "speaking" ? listHistory({ type: "writing", limit: 1000 }) : Promise.resolve([]),
    type !== "writing" ? listHistory({ type: "speaking", limit: 1000 }) : Promise.resolve([]),
  ]);

  let csv = "\uFEFF"; // UTF-8 BOM

  if (type === "all") {
    if (writingRecs.length) {
      csv += "=== Writing ===\r\n";
      csv += writingRows(writingRecs as WritingRecord[]);
      csv += "\r\n\r\n";
    }
    if (speakingRecs.length) {
      csv += "=== Speaking ===\r\n";
      csv += speakingRows(speakingRecs as SpeakingRecord[]);
    }
  } else if (type === "writing") {
    csv += writingRows(writingRecs as WritingRecord[]);
  } else {
    csv += speakingRows(speakingRecs as SpeakingRecord[]);
  }

  const filename = `ielts-history-${type}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
