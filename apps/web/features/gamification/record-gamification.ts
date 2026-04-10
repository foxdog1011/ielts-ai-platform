// features/gamification/record-gamification.ts
//
// Called after successful writing/speaking scoring to update streak and award XP.
// Never throws — errors are silently absorbed to avoid breaking the scoring pipeline.

import { recordPractice } from "@/features/gamification/streak-service";
import { awardXP, XP_AMOUNTS } from "@/features/gamification/xp-service";
import { checkAndUpdatePR } from "@/features/gamification/pr-service";
import { recordWeeklyProgress } from "@/features/gamification/weekly-goals";
import { recordActivity, anonymizeUserId } from "@/features/activity/activity-service";
import { updateLeaderboard } from "@/features/leaderboard/leaderboard-service";

export interface GamificationInput {
  readonly userId: string;
  readonly examType: "writing" | "speaking";
  readonly overallBand?: number;
  readonly taskType?: string;
  readonly isDailyChallenge?: boolean;
  readonly dimensionScores?: Record<string, number>;
}

export async function recordGamification(input: GamificationInput): Promise<void> {
  try {
    // Record practice for streak
    await recordPractice(input.userId);

    // Award base XP
    const baseXP =
      input.examType === "writing" ? XP_AMOUNTS.writing : XP_AMOUNTS.speaking;
    await awardXP(input.userId, baseXP, `${input.examType} submission`);

    // Perfect score bonus (>8.0)
    if (input.overallBand != null && input.overallBand > 8.0) {
      await awardXP(
        input.userId,
        XP_AMOUNTS.perfectScoreBonus,
        `perfect score bonus (${input.overallBand})`,
      );
    }

    // Check for personal records
    let isNewPR = false;
    if (input.dimensionScores && Object.keys(input.dimensionScores).length > 0) {
      const newPRs = await checkAndUpdatePR(input.userId, input.examType, input.dimensionScores);
      isNewPR = newPRs.length > 0;
    }

    // Record to activity feed
    if (input.overallBand != null) {
      const displayName = anonymizeUserId(input.userId);
      await recordActivity({
        userId: input.userId,
        displayName,
        type: input.examType,
        taskType: input.taskType,
        overallBand: input.overallBand,
        isNewPR,
        createdAt: Date.now(),
      });
    }

    // Update leaderboard
    if (input.overallBand != null) {
      const lbName = anonymizeUserId(input.userId);
      await updateLeaderboard(input.userId, lbName, input.examType, input.overallBand);
    }

    // Record weekly progress
    await recordWeeklyProgress(input.userId);

    // Daily challenge bonus
    if (input.isDailyChallenge) {
      const { markDailyCompleted } = await import("@/features/gamification/daily-challenge");
      await markDailyCompleted(input.userId);
      await awardXP(input.userId, XP_AMOUNTS.dailyChallenge, "daily challenge completed");
    }
  } catch {
    // Gamification must never break scoring — silently absorb errors
  }
}
