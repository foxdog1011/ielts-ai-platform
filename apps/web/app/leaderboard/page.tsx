// app/leaderboard/page.tsx
//
// Full-page leaderboard view — Duolingo-inspired design.

import Link from "next/link";
import { Leaderboard } from "@/features/leaderboard/components/Leaderboard";
import { getUserId } from "@/features/gamification/get-user-id";

export const metadata = { title: "排行榜 — IELTS AI" };

export default async function LeaderboardPage() {
  const userId = await getUserId().catch(() => "anonymous");

  return (
    <main className="min-h-dvh bg-[#F7F5FF] text-gray-800 font-brand">
      <header className="mx-auto max-w-3xl px-4 sm:px-8 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-2xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold min-h-[44px] flex items-center hover:border-[#58CC02] hover:text-[#58CC02] transition-all shadow-[3px_3px_0_0_rgba(0,0,0,0.08)]"
            >
              &larr; 首頁
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-3xl">🏆</span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                排行榜
              </h1>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 sm:px-8 pb-12">
        <Leaderboard currentUserId={userId} />
      </section>
    </main>
  );
}
