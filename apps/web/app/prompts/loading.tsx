export default function LoadingPrompts() {
  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-6xl px-6 sm:px-8 pt-8 pb-4">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-100" />
      </header>
      <section className="mx-auto max-w-6xl px-6 sm:px-8 pb-12 space-y-6">
        <div className="h-28 animate-pulse rounded-2xl bg-zinc-100" />
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm backdrop-blur">
          <div className="h-5 w-20 animate-pulse rounded bg-zinc-100" />
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
