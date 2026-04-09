// features/gamification/index.ts — barrel exports

export { getStreak, recordPractice, useStreakFreeze } from "./streak-service";
export type { StreakInfo } from "./streak-service";

export { getXP, awardXP, XP_AMOUNTS } from "./xp-service";
export type { XPInfo } from "./xp-service";

export { getDailyChallenge, markDailyCompleted } from "./daily-challenge";
export type { DailyChallenge } from "./daily-challenge";

export { getUserId, getUserIdFromHeaders } from "./get-user-id";
