export default function LoadingHistory() {
  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-100" />
      </header>

      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
          {/* 表頭骨架 */}
          <div className="mb-3 grid grid-cols-[1fr_0.6fr_0.6fr_2fr_1.2fr_0.6fr] gap-3">
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-14 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-12 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-14 animate-pulse rounded bg-zinc-100 justify-self-end" />
          </div>

          {/* 列表骨架 */}
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_0.6fr_0.6fr_2fr_1.2fr_0.6fr] items-center gap-3 border-t border-zinc-200 py-3"
              >
                <div className="h-4 w-28 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-16 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-10 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
                <div className="flex gap-2">
                  <div className="h-4 w-16 animate-pulse rounded bg-zinc-100" />
                  <div className="h-4 w-14 animate-pulse rounded bg-zinc-100" />
                  <div className="h-4 w-12 animate-pulse rounded bg-zinc-100" />
                </div>
                <div className="h-4 w-10 animate-pulse rounded bg-zinc-100 justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
