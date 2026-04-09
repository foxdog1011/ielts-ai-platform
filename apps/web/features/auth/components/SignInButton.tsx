// features/auth/components/SignInButton.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";

/**
 * Renders a sign-in or sign-out button based on current session state.
 * Intended for use in the site header / nav bar.
 */
export function SignInButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-8 w-16 animate-pulse rounded-lg bg-zinc-200" />
    );
  }

  if (session?.user) {
    return (
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
      >
        登出
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn()}
      className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[12px] font-medium text-blue-900 hover:bg-blue-100 transition-colors"
    >
      登入
    </button>
  );
}
