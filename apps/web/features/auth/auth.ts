// features/auth/auth.ts
//
// NextAuth v5 handler — exports auth(), signIn(), signOut(), handlers.
// This is the single source of truth for auth in the application.

import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
