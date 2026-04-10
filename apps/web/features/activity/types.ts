// features/activity/types.ts
//
// Types for the Strava-style activity feed.

export interface ActivityItem {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string; // "User_abc123" style
  readonly type: "writing" | "speaking";
  readonly taskType?: string; // "task1", "task2", "part1", etc.
  readonly overallBand: number;
  readonly isNewPR: boolean;
  readonly createdAt: number; // Unix timestamp ms
}

export type ActivityInput = Omit<ActivityItem, "id">;

export interface ActivityApiResponse {
  readonly success: boolean;
  readonly data?: readonly ActivityItem[];
  readonly error?: string;
}
