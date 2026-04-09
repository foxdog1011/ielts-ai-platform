// features/gamification/record-gamification.ts
//
// Called after successful writing/speaking scoring to update streak and award XP.
// Never throws — errors are silently absorbed to avoid breaking the scoring pipeline.

import { recordPractice } from "@/features/gamification/streak-service";
import { awardXP, XP_AMOUNTS } from "@/features/gamification/xp-service";

export interface GamificationInput {
  readonly userId: string;
  readonly examType: "writing" | "speaking";
  readonly overallBand?: number;
  readonly isDailyChallenge?: boolean;
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
