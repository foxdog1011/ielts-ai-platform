// app/leaderboard/page.tsx
//
// Full-page leaderboard view.

import Link from "next/link";
import { Leaderboard } from "@/features/leaderboard/components/Leaderboard";
import { getUserId } from "@/features/gamification/get-user-id";

export const metadata = { title: "排行榜 — IELTS AI" };

export default async function LeaderboardPage() {
  const userId = await getUserId().catch(() => "anonymous");

  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--text)] font-brand">
      <header className="mx-auto max-w-3xl px-4 sm:px-8 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] min-h-[44px] flex items-center hover:border-[var(--color-primary-200)] hover:text-[var(--color-primary)] theme-transition"
            >
              &larr; Home
            </Link>
            <h1 className="text-[20px] font-semibold tracking-tight">排行榜</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 sm:px-8 pb-12">
        <Leaderboard currentUserId={userId} />
      </section>
    </main>
  );
}
