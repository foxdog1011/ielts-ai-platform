// features/coaching/index.ts — public API for coaching
export { buildCoachSnapshot, computeRecurringAnomalies } from "@/lib/coach";
export type {
  CoachSnapshotInput,
  LearnerProfile,
  CoachSummary,
  NextActionCandidate,
  WeeklySummaryPreview,
  CoachSnapshot,
} from "@/lib/coach";
