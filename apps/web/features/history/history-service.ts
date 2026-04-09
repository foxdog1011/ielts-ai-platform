// features/history/history-service.ts — re-export from original location
export {
  saveHistory,
  listHistory,
  latestHistory,
  latestOfType,
} from "@/lib/history";
export type {
  WritingBand,
  SpeakingBand,
  BaseRecord,
  WritingRecord,
  SpeakingRecord,
  HistoryRecord,
} from "@/lib/history";
