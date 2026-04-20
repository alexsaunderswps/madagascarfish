import type { Config } from "tailwindcss";

/**
 * Tailwind color overrides for the Registry redesign (Gate 1).
 *
 * `slate` and `sky` are fully remapped to the journal palette documented in
 * `docs/design.md` §12. Existing `bg-slate-*` / `text-sky-*` utility classes
 * across ~309 call sites inherit the new palette without component edits.
 *
 * Mapping rules:
 * - slate-50/100 → bg / bg-sunken (page surfaces)
 * - slate-200/300/400 → rule / rule-strong (borders, placeholders)
 * - slate-500 → ink-3 (captions, eyebrows)
 * - slate-600/700/800/900 → ink-2 / ink (body, headings)
 * - sky-50/100 → accent-soft
 * - sky-500/600/700 → accent
 * - sky-800/900 → accent-2 (hover / deepest)
 *
 * Other Tailwind palettes (amber, emerald, rose, …) are left alone — they
 * carry semantic meaning (warnings, success) that should not be recolored.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50:  "#FAFAF7",
          100: "#F0EEE6",
          200: "#DCD9CE",
          300: "#C4C0B2",
          400: "#A8A598",
          500: "#6B7670",
          600: "#4E5751",
          700: "#2E3834",
          800: "#1E2521",
          900: "#0F1412",
          950: "#080B0A",
        },
        sky: {
          50:  "#EEF5F2",
          100: "#D6E6E0",
          200: "#B8D3CA",
          300: "#8DBAAE",
          400: "#5A9684",
          500: "#2B6E5F",
          600: "#245C4F",
          700: "#1B473C",
          800: "#153831",
          900: "#0F2A2E",
          950: "#0A1F22",
        },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        surface: {
          DEFAULT: "var(--bg)",
          raised: "var(--bg-raised)",
          sunken: "var(--bg-sunken)",
        },
        rule: {
          DEFAULT: "var(--rule)",
          strong: "var(--rule-strong)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          2: "var(--accent-2)",
          soft: "var(--accent-soft)",
        },
        terracotta: "var(--terracotta)",
        highlight: "var(--highlight)",
      },
      fontFamily: {
        serif: ["var(--font-spectral)", "Charter", "Georgia", "serif"],
        sans:  ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono:  ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
