// apps/web/lib/kv.ts
//
// Backward-compatible facade. Delegates to shared/infrastructure/kv.ts
// for pure KV operations and shared/domain/types.ts for domain types.
// Business logic (saveScore, listScores) remains here until all
// consumers migrate to features/ imports.

import { unstable_noStore as noStore } from "next/cache";

// Re-export pure KV operations from shared layer
export {
  kvSetJSON,
  kvGetJSON,
  kvListPushJSON,
  kvListTailJSON,
  kvSetAdd,
  kvSetHas,
  kvDiag,
} from "@/shared/infrastructure/kv";

// Re-export domain types from shared layer
export type {
  DiagSummary,
  PlanSnapshot,
  ScorePayload,
} from "@/shared/domain/types";

// Import what we need for business logic
import { kvListPushJSON, kvListTailJSON } from "@/shared/infrastructure/kv";
import type { ScorePayload } from "@/shared/domain/types";

/* ------------------------------------------------------------------ */
/* Score persistence (business logic — stays here for now)             */
/* ------------------------------------------------------------------ */

function scoreListKey(kind: "writing" | "speaking") {
  return `scores:v1:${kind}`;
}

/** Write one score entry (tail-push), returns the object with createdAt. */
export async function saveScore(
  kind: "writing" | "speaking",
  payload: Omit<ScorePayload, "createdAt">
): Promise<ScorePayload> {
  noStore();
  const rec: ScorePayload = {
    ...payload,
    createdAt: new Date().toISOString(),
  };
  await kvListPushJSON(scoreListKey(kind), rec);
  return rec;
}

/** Read the last `take` entries (old to new). */
export async function listScores(
  kind: "writing" | "speaking",
  take = 200
): Promise<ScorePayload[]> {
  noStore();
  return kvListTailJSON<ScorePayload>(scoreListKey(kind), take);
}
