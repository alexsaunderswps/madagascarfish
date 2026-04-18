"use client";

import { useEffect, useState } from "react";

function formatAgo(ms: number): string {
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export default function UpdatedAgo({ iso }: { iso: string }) {
  const ts = Date.parse(iso);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (Number.isNaN(ts)) return null;
  return (
    <time dateTime={iso} className="text-xs text-slate-500" title={new Date(ts).toISOString()}>
      {now === null ? "Updated recently" : `Updated ${formatAgo(now - ts)}`}
    </time>
  );
}
