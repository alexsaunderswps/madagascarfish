"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { InstitutionPopulationDetail } from "@/lib/institutionDashboard";

import { editPopulationAction, type EditPopulationErrors } from "./actions";

type BreedingStatus = "breeding" | "non-breeding" | "unknown";

export default function EditPopulationForm({
  population,
}: {
  population: InstitutionPopulationDetail;
}) {
  const t = useTranslations("dashboard.institution.edit");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<EditPopulationErrors>({});
  const [transientError, setTransientError] = useState<string | null>(null);

  const [countTotal, setCountTotal] = useState<string>(
    population.count_total != null ? String(population.count_total) : "",
  );
  const [countMale, setCountMale] = useState<string>(
    population.count_male != null ? String(population.count_male) : "",
  );
  const [countFemale, setCountFemale] = useState<string>(
    population.count_female != null ? String(population.count_female) : "",
  );
  const [countUnsexed, setCountUnsexed] = useState<string>(
    population.count_unsexed != null ? String(population.count_unsexed) : "",
  );
  const [breedingStatus, setBreedingStatus] = useState<BreedingStatus>(
    population.breeding_status,
  );
  const [lastCensusDate, setLastCensusDate] = useState<string>(
    population.last_census_date ?? "",
  );
  const [notes, setNotes] = useState<string>(population.notes ?? "");
  const [studbookManaged, setStudbookManaged] = useState<boolean>(
    population.studbook_managed,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTransientError(null);
    const parseInt = (s: string): number | null =>
      s.trim() === "" ? null : Number.isFinite(Number(s)) ? Math.trunc(Number(s)) : null;

    startTransition(async () => {
      const result = await editPopulationAction({
        populationId: population.id,
        count_total: parseInt(countTotal),
        count_male: parseInt(countMale),
        count_female: parseInt(countFemale),
        count_unsexed: parseInt(countUnsexed),
        breeding_status: breedingStatus,
        last_census_date: lastCensusDate || null,
        notes,
        studbook_managed: studbookManaged,
      });

      if (result.ok) {
        router.push("/dashboard/institution");
        return;
      }
      if ("transientError" in result) {
        setTransientError(result.transientError);
        return;
      }
      setErrors(result.errors);
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">
          <span className="italic">{population.species.scientific_name}</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t("subtitle", { institution: population.institution.name })}
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded border border-slate-200 bg-white p-6"
      >
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

        <div className="grid grid-cols-2 gap-4">
          <Field
            id="count_total"
            label={t("fields.countTotal")}
            value={countTotal}
            onChange={setCountTotal}
            type="number"
            error={errors.count_total}
          />
          <Field
            id="count_male"
            label={t("fields.countMale")}
            value={countMale}
            onChange={setCountMale}
            type="number"
            error={errors.count_male}
          />
          <Field
            id="count_female"
            label={t("fields.countFemale")}
            value={countFemale}
            onChange={setCountFemale}
            type="number"
            error={errors.count_female}
          />
          <Field
            id="count_unsexed"
            label={t("fields.countUnsexed")}
            value={countUnsexed}
            onChange={setCountUnsexed}
            type="number"
            error={errors.count_unsexed}
          />
        </div>

        <div>
          <label
            htmlFor="breeding_status"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            {t("fields.breedingStatus")}
          </label>
          <select
            id="breeding_status"
            value={breedingStatus}
            onChange={(e) => setBreedingStatus(e.target.value as BreedingStatus)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          >
            <option value="breeding">{t("breedingStatus.breeding")}</option>
            <option value="non-breeding">
              {t("breedingStatus.nonBreeding")}
            </option>
            <option value="unknown">{t("breedingStatus.unknown")}</option>
          </select>
          {errors.breeding_status ? (
            <p className="mt-1 text-xs text-red-600">{errors.breeding_status}</p>
          ) : null}
        </div>

        <Field
          id="last_census_date"
          label={t("fields.lastCensusDate")}
          value={lastCensusDate}
          onChange={setLastCensusDate}
          type="date"
          error={errors.last_census_date}
        />

        <div>
          <label
            htmlFor="notes"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            {t("fields.notes")}
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
          {errors.notes ? (
            <p className="mt-1 text-xs text-red-600">{errors.notes}</p>
          ) : null}
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={studbookManaged}
            onChange={(e) => setStudbookManaged(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            {t("fields.studbookManaged")}
          </span>
        </label>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/institution"
            className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            {t("cancel")}
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: "text" | "number" | "date";
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
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
