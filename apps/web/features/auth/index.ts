// features/auth/index.ts
//
// Barrel export for the auth feature.

export { auth, signIn, signOut, handlers } from "./auth";
export { SessionProvider } from "./components/SessionProvider";
export { SignInButton } from "./components/SignInButton";
export { UserMenu } from "./components/UserMenu";
export { RATE_LIMIT_TIERS } from "./types";
export type { UserRole, RateLimitTier } from "./types";
