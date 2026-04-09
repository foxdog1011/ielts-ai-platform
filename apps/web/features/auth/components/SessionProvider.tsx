// features/auth/components/SessionProvider.tsx
"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}

/**
 * Client-side session provider wrapper.
 * Must wrap the app tree so useSession() works in client components.
 */
export function SessionProvider({ children }: Props) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
