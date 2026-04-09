// features/auth/components/UserMenu.tsx
"use client";

import { useSession } from "next-auth/react";
import { SignInButton } from "./SignInButton";

/**
 * Shows user avatar + name when logged in, or SignInButton when not.
 * Designed for the site header.
 */
export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-200" />
        <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
      </div>
    );
  }

  if (!session?.user) {
    return <SignInButton />;
  }

  const { name, email, image } = session.user;
  const displayName = name ?? email ?? "User";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={displayName}
          className="h-7 w-7 rounded-full border border-zinc-200"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 border border-blue-200">
          {initials}
        </div>
      )}
      <span className="text-[12px] font-medium text-zinc-700 max-w-[100px] truncate">
        {displayName}
      </span>
      <SignInButton />
    </div>
  );
}
