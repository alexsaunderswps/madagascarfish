"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-2xl font-semibold">Data temporarily unavailable</h1>
      <p className="mt-4 text-slate-600">
        Something went wrong rendering this page. You can try again, or return
        to the home page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
      >
        Try again
      </button>
    </main>
  );
}
