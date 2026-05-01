"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  BreedingEventListResponse,
  BreedingEventType,
  InstitutionPopulationRow,
} from "@/lib/institutionDashboard";

import {
  type LogBreedingEventErrors,
  logBreedingEventAction,
} from "./actions";

const EVENT_TYPES: BreedingEventType[] = [
  "spawning",
  "hatching",
  "mortality",
  "acquisition",
  "disposition",
  "other",
];

export default function BreedingEventsView({
  events,
  populations,
}: {
  events: BreedingEventListResponse | null;
  populations: InstitutionPopulationRow[];
}) {
  const t = useTranslations("dashboard.institution.breedingEvents");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<LogBreedingEventErrors>({});
  const [transientError, setTransientError] = useState<string | null>(null);

  const [populationId, setPopulationId] = useState<string>(
    populations[0]?.id ? String(populations[0].id) : "",
  );
  const [eventType, setEventType] = useState<BreedingEventType>("hatching");
  const [eventDate, setEventDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [deltaMale, setDeltaMale] = useState<string>("");
  const [deltaFemale, setDeltaFemale] = useState<string>("");
  const [deltaUnsexed, setDeltaUnsexed] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTransientError(null);
    const parseInt = (s: string): number | null =>
      s.trim() === "" ? null : Number.isFinite(Number(s)) ? Math.trunc(Number(s)) : null;
    if (!populationId) {
      setErrors({ population: t("errors.populationRequired") });
      return;
    }
    startTransition(async () => {
      const result = await logBreedingEventAction({
        population: Number(populationId),
        event_type: eventType,
        event_date: eventDate,
        count_delta_male: parseInt(deltaMale),
        count_delta_female: parseInt(deltaFemale),
        count_delta_unsexed: parseInt(deltaUnsexed),
        notes,
      });
      if (result.ok) {
        // Reset form and refresh.
        setDeltaMale("");
        setDeltaFemale("");
        setDeltaUnsexed("");
        setNotes("");
        router.refresh();
        return;
      }
      if ("transientError" in result) {
        setTransientError(result.transientError);
        return;
      }
      setErrors(result.errors);
    });
  }

  const empty = !events || events.results.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">{t("title")}</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">{t("subtitle")}</p>
      </header>

      <section className="mb-10 rounded border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-serif text-xl text-slate-900">
          {t("logForm.heading")}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.form ? (
            <p
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {errors.form}
            </p>
          ) : null}
          {transientError ? (
            <p
              role="alert"
              className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              {transientError}
            </p>
          ) : null}

          <div>
            <label
              htmlFor="population"
              className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
            >
              {t("logForm.population")}
            </label>
            {populations.length === 0 ? (
              <p className="text-sm text-slate-600">{t("logForm.noPopulations")}</p>
            ) : (
              <select
                id="population"
                value={populationId}
                onChange={(e) => setPopulationId(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              >
                {populations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.species.scientific_name} (#{p.id})
                  </option>
                ))}
              </select>
            )}
            {errors.population ? (
              <p className="mt-1 text-xs text-red-600">{errors.population}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="event_type"
                className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
              >
                {t("logForm.eventType")}
              </label>
              <select
                id="event_type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as BreedingEventType)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              >
                {EVENT_TYPES.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`eventTypes.${kind}`)}
                  </option>
                ))}
              </select>
              {errors.event_type ? (
                <p className="mt-1 text-xs text-red-600">{errors.event_type}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="event_date"
                className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
              >
                {t("logForm.eventDate")}
              </label>
              <input
                id="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              {errors.event_date ? (
                <p className="mt-1 text-xs text-red-600">{errors.event_date}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <DeltaField
              id="count_delta_male"
              label={t("logForm.deltaMale")}
              value={deltaMale}
              onChange={setDeltaMale}
              error={errors.count_delta_male}
            />
            <DeltaField
              id="count_delta_female"
              label={t("logForm.deltaFemale")}
              value={deltaFemale}
              onChange={setDeltaFemale}
              error={errors.count_delta_female}
            />
            <DeltaField
              id="count_delta_unsexed"
              label={t("logForm.deltaUnsexed")}
              value={deltaUnsexed}
              onChange={setDeltaUnsexed}
              error={errors.count_delta_unsexed}
            />
          </div>
          <p className="text-xs text-slate-500">{t("logForm.deltaHelp")}</p>

          <div>
            <label
              htmlFor="notes"
              className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
            >
              {t("logForm.notes")}
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              placeholder={t("logForm.notesPlaceholder")}
            />
            {errors.notes ? (
              <p className="mt-1 text-xs text-red-600">{errors.notes}</p>
            ) : null}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={pending || populations.length === 0}
              className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? t("logForm.logging") : t("logForm.logEvent")}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl text-slate-900">
          {t("recent.heading")}
        </h2>
        {empty ? (
          <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-700">
            {t("recent.empty")}
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("recent.table.date")}</th>
                  <th className="px-4 py-3">{t("recent.table.species")}</th>
                  <th className="px-4 py-3">{t("recent.table.eventType")}</th>
                  <th className="px-4 py-3">{t("recent.table.delta")}</th>
                  <th className="px-4 py-3">{t("recent.table.notes")}</th>
                  <th className="px-4 py-3">{t("recent.table.reporter")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events!.results.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{row.event_date}</td>
                    <td className="px-4 py-3">
                      <span className="font-serif italic text-slate-900">
                        {row.species.scientific_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {t(`eventTypes.${row.event_type}`)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDelta(row, t)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.notes || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {row.reporter_email ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function DeltaField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function formatDelta(
  row: { count_delta_male: number | null; count_delta_female: number | null; count_delta_unsexed: number | null },
  t: ReturnType<typeof useTranslations>,
): string {
  const parts: string[] = [];
  if (row.count_delta_male != null && row.count_delta_male !== 0) {
    parts.push(`${signed(row.count_delta_male)} ${t("recent.male")}`);
  }
  if (row.count_delta_female != null && row.count_delta_female !== 0) {
    parts.push(`${signed(row.count_delta_female)} ${t("recent.female")}`);
  }
  if (row.count_delta_unsexed != null && row.count_delta_unsexed !== 0) {
    parts.push(`${signed(row.count_delta_unsexed)} ${t("recent.unsexed")}`);
  }
  return parts.length ? parts.join(", ") : "—";
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
