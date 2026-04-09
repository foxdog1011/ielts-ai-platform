// features/auth/types.ts
//
// Shared types for the authentication feature.

import type { DefaultSession } from "next-auth";

/**
 * Extend the built-in session type to include our custom fields.
 * This keeps all auth-related type augmentations in one place.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

/** Roles for future RBAC expansion. */
export type UserRole = "free" | "premium" | "admin";

/** Rate-limit tier derived from auth status. */
export interface RateLimitTier {
  readonly maxRequests: number;
  readonly windowSeconds: number;
}

/** Tiers for unauthenticated vs authenticated users. */
export const RATE_LIMIT_TIERS: Readonly<Record<"anonymous" | "authenticated", RateLimitTier>> = {
  anonymous: { maxRequests: 10, windowSeconds: 3600 },
  authenticated: { maxRequests: 50, windowSeconds: 3600 },
} as const;
