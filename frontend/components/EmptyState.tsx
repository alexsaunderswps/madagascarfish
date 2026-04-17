import Link from "next/link";
import type { ReactNode } from "react";

export interface EmptyStateAction {
  href: string;
  label: string;
}

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  variant?: "card" | "inline";
  "aria-label"?: string;
}

export default function EmptyState({
  title,
  body,
  primaryAction,
  secondaryAction,
  variant = "card",
  "aria-label": ariaLabel,
}: EmptyStateProps) {
  const wrapperClass =
    variant === "inline"
      ? "rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm"
      : "rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center";

  return (
    <div role="status" aria-label={ariaLabel ?? title} className={wrapperClass}>
      <h2 className="font-serif text-xl text-slate-900">{title}</h2>
      {body ? <p className="mt-2 text-sm text-slate-600">{body}</p> : null}
      {(primaryAction || secondaryAction) && (
        <div
          className={
            variant === "inline"
              ? "mt-3 flex flex-wrap gap-2"
              : "mt-4 flex flex-wrap justify-center gap-2"
          }
        >
          {primaryAction ? (
            <Link
              href={primaryAction.href}
              className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              {primaryAction.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
