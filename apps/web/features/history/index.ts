// features/history/index.ts — public API for history feature
export {
  saveHistory,
  listHistory,
  latestHistory,
  latestOfType,
} from "./history-service";
export type {
  WritingBand,
  SpeakingBand,
  BaseRecord,
  WritingRecord,
  SpeakingRecord,
  HistoryRecord,
} from "./history-service";
