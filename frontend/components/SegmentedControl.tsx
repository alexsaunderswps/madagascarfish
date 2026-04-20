"use client";

/**
 * SegmentedControl — mutually-exclusive option group (§15.4).
 *
 * Same visual language as FilterChip but tightly grouped with no gap so the
 * siblings read as one composite control. Use when options are mutually
 * exclusive (e.g. Directory density, Red List category single-select).
 *
 * Keyboard contract:
 *   ArrowLeft / ArrowRight — move focus + selection to previous/next option
 *   Home / End             — jump to first / last option
 *   Enter / Space          — activate focused option (no-op if already active)
 */

import { useRef, type KeyboardEvent } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  ariaLabel?: string;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  name?: string;
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  name,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusAt = (idx: number) => {
    const clamped = (idx + options.length) % options.length;
    refs.current[clamped]?.focus();
    onChange(options[clamped].value);
  };

  const handleKey = (idx: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusAt(idx - 1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusAt(idx + 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        borderRadius: 999,
        border: "1px solid var(--rule-strong)",
        backgroundColor: "var(--bg-raised)",
        padding: 2,
        gap: 0,
      }}
    >
      {options.map((opt, idx) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel ?? opt.label}
            tabIndex={selected ? 0 : -1}
            name={name}
            onClick={() => onChange(opt.value)}
            onKeyDown={handleKey(idx)}
            style={{
              minHeight: 44,
              padding: "5px 14px",
              borderRadius: 999,
              fontFamily: "var(--sans)",
              fontSize: 11,
              fontWeight: selected ? 600 : 500,
              lineHeight: 1,
              cursor: "pointer",
              backgroundColor: selected ? "var(--accent-soft)" : "transparent",
              color: selected ? "var(--accent-2)" : "var(--ink-2)",
              border: "none",
              transition: "background-color 120ms ease, color 120ms ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
