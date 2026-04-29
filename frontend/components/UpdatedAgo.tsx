"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function UpdatedAgo({ iso }: { iso: string }) {
  const t = useTranslations("common.updatedAgo");
  const ts = Date.parse(iso);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (Number.isNaN(ts)) return null;

  function formatAgo(ms: number): string {
    if (ms < 0) return t("justNow");
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return t("justNow");
    const min = Math.floor(sec / 60);
    if (min < 60) return t("minutes", { count: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return t("hours", { count: hr });
    const day = Math.floor(hr / 24);
    return t("days", { count: day });
  }

  return (
    <time dateTime={iso} className="text-xs text-slate-500" title={new Date(ts).toISOString()}>
      {now === null
        ? t("updatedRecently")
        : t("updatedTemplate", { ago: formatAgo(now - ts) })}
    </time>
  );
}
