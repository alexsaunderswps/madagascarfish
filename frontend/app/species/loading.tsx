export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="h-96 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </main>
  );
}
