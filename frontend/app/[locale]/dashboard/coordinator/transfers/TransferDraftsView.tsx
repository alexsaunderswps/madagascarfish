"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  TransferDetailRow,
  TransferListResponse,
  TransferStatusValue,
} from "@/lib/coordinatorDashboard";

import {
  type TransferDraftErrors,
  type TransferDraftInput,
  createTransferDraftAction,
  updateTransferDraftAction,
} from "./actions";

interface SpeciesBrief {
  id: number;
  scientific_name: string;
  iucn_status: string;
}
interface InstitutionBrief {
  id: number;
  name: string;
  country: string;
}

const STATUSES: TransferStatusValue[] = [
  "proposed",
  "approved",
  "in_transit",
  "completed",
  "cancelled",
];

const STATUS_GROUP_ORDER: TransferStatusValue[] = [
  "proposed",
  "approved",
  "in_transit",
  "completed",
  "cancelled",
];

export default function TransferDraftsView({
  transfers,
  species,
  institutions,
}: {
  transfers: TransferListResponse | null;
  species: SpeciesBrief[];
  institutions: InstitutionBrief[];
}) {
  const t = useTranslations("dashboard.coordinator.transferDrafts");
  const grouped = groupByStatus(transfers?.results ?? []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">{t("title")}</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">{t("subtitle")}</p>
      </header>

      {transfers === null ? (
        <p
          role="alert"
          className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {t("transientError")}
        </p>
      ) : (
        <>
          <CreateForm species={species} institutions={institutions} />

          {STATUS_GROUP_ORDER.map((status) => {
            const rows = grouped[status] ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={status} className="mt-10">
                <h2 className="mb-3 font-serif text-xl text-slate-900">
                  {t(`statusHeadings.${status}`, { count: rows.length })}
                </h2>
                <ul className="space-y-3">
                  {rows.map((tr) => (
                    <TransferCard
                      key={tr.id}
                      transfer={tr}
                      species={species}
                      institutions={institutions}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}

function groupByStatus(
  rows: TransferDetailRow[],
): Record<TransferStatusValue, TransferDetailRow[]> {
  const out: Record<TransferStatusValue, TransferDetailRow[]> = {
    proposed: [],
    approved: [],
    in_transit: [],
    completed: [],
    cancelled: [],
  };
  for (const row of rows) {
    out[row.status]?.push(row);
  }
  return out;
}

function CreateForm({
  species,
  institutions,
}: {
  species: SpeciesBrief[];
  institutions: InstitutionBrief[];
}) {
  const t = useTranslations("dashboard.coordinator.transferDrafts");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<TransferDraftErrors>({});
  const [transientError, setTransientError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [speciesId, setSpeciesId] = useState<string>(
    species[0]?.id ? String(species[0].id) : "",
  );
  const [sourceId, setSourceId] = useState<string>(
    institutions[0]?.id ? String(institutions[0].id) : "",
  );
  const [destId, setDestId] = useState<string>(
    institutions[1]?.id ? String(institutions[1].id) : "",
  );
  const [status, setStatus] = useState<TransferStatusValue>("proposed");
  const [proposedDate, setProposedDate] = useState<string>(today);
  const [plannedDate, setPlannedDate] = useState<string>("");
  const [countMale, setCountMale] = useState<string>("");
  const [countFemale, setCountFemale] = useState<string>("");
  const [countUnsexed, setCountUnsexed] = useState<string>("");
  const [cites, setCites] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTransientError(null);
    const parseInt = (s: string): number | null =>
      s.trim() === "" ? null : Number.isFinite(Number(s)) ? Math.trunc(Number(s)) : null;
    if (!speciesId || !sourceId || !destId) {
      setErrors({ form: t("errors.requiredFields") });
      return;
    }
    const input: TransferDraftInput = {
      species: Number(speciesId),
      source_institution: Number(sourceId),
      destination_institution: Number(destId),
      status,
      proposed_date: proposedDate,
      planned_date: plannedDate,
      actual_date: "",
      count_male: parseInt(countMale),
      count_female: parseInt(countFemale),
      count_unsexed: parseInt(countUnsexed),
      cites_reference: cites,
      notes,
    };
    startTransition(async () => {
      const result = await createTransferDraftAction(input);
      if (result.ok) {
        // Reset minimal — keep source/dest selections for repeat drafting.
        setCountMale("");
        setCountFemale("");
        setCountUnsexed("");
        setCites("");
        setNotes("");
        setOpen(false);
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-sky-700 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
      >
        {t("createForm.openButton")}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded border border-slate-200 bg-white p-6"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl text-slate-900">
          {t("createForm.heading")}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:underline"
        >
          {t("createForm.cancel")}
        </button>
      </div>

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

      <SelectField
        id="species"
        label={t("createForm.species")}
        value={speciesId}
        onChange={setSpeciesId}
        error={errors.species}
        options={species.map((s) => ({
          value: String(s.id),
          label: `${s.scientific_name} (${s.iucn_status || "—"})`,
        }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          id="source"
          label={t("createForm.source")}
          value={sourceId}
          onChange={setSourceId}
          error={errors.source_institution}
          options={institutions.map((i) => ({
            value: String(i.id),
            label: `${i.name} (${i.country})`,
          }))}
        />
        <SelectField
          id="destination"
          label={t("createForm.destination")}
          value={destId}
          onChange={setDestId}
          error={errors.destination_institution}
          options={institutions.map((i) => ({
            value: String(i.id),
            label: `${i.name} (${i.country})`,
          }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          id="status"
          label={t("createForm.status")}
          value={status}
          onChange={(v) => setStatus(v as TransferStatusValue)}
          options={STATUSES.map((s) => ({
            value: s,
            label: t(`statuses.${s}`),
          }))}
        />
        <TextField
          id="proposed_date"
          label={t("createForm.proposedDate")}
          type="date"
          value={proposedDate}
          onChange={setProposedDate}
          error={errors.proposed_date}
        />
        <TextField
          id="planned_date"
          label={t("createForm.plannedDate")}
          type="date"
          value={plannedDate}
          onChange={setPlannedDate}
          error={errors.planned_date}
        />
        <TextField
          id="cites"
          label={t("createForm.citesReference")}
          value={cites}
          onChange={setCites}
          error={errors.cites_reference}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TextField
          id="count_male"
          label={t("createForm.countMale")}
          type="number"
          value={countMale}
          onChange={setCountMale}
          error={errors.count_male}
        />
        <TextField
          id="count_female"
          label={t("createForm.countFemale")}
          type="number"
          value={countFemale}
          onChange={setCountFemale}
          error={errors.count_female}
        />
        <TextField
          id="count_unsexed"
          label={t("createForm.countUnsexed")}
          type="number"
          value={countUnsexed}
          onChange={setCountUnsexed}
          error={errors.count_unsexed}
        />
      </div>
      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
        >
          {t("createForm.notes")}
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
        />
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("createForm.creating") : t("createForm.create")}
        </button>
      </div>
    </form>
  );
}

function TransferCard({
  transfer,
  species,
  institutions,
}: {
  transfer: TransferDetailRow;
  species: SpeciesBrief[];
  institutions: InstitutionBrief[];
}) {
  const t = useTranslations("dashboard.coordinator.transferDrafts");
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <EditForm
        transfer={transfer}
        species={species}
        institutions={institutions}
        onClose={() => setEditing(false)}
      />
    );
  }
  return (
    <li className="rounded border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg italic text-slate-900">
            {transfer.species.scientific_name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {transfer.source_institution.name} → {transfer.destination_institution.name}
            {" · "}
            {t(`statuses.${transfer.status}`)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-sky-700 underline underline-offset-2 hover:text-sky-900"
        >
          {t("card.edit")}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        {t("card.proposedAt", { date: transfer.proposed_date })}
        {transfer.planned_date
          ? ` · ${t("card.plannedAt", { date: transfer.planned_date })}`
          : ""}
        {transfer.actual_date
          ? ` · ${t("card.actualAt", { date: transfer.actual_date })}`
          : ""}
      </p>
      {transfer.notes ? (
        <p className="mt-2 text-sm text-slate-700">{transfer.notes}</p>
      ) : null}
      {transfer.created_by_email ? (
        <p className="mt-3 text-[11px] text-slate-400">
          {t("card.draftedBy", { email: transfer.created_by_email })}
        </p>
      ) : null}
    </li>
  );
}

function EditForm({
  transfer,
  species: _species,
  institutions: _institutions,
  onClose,
}: {
  transfer: TransferDetailRow;
  species: SpeciesBrief[];
  institutions: InstitutionBrief[];
  onClose: () => void;
}) {
  const t = useTranslations("dashboard.coordinator.transferDrafts");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<TransferDraftErrors>({});
  const [transientError, setTransientError] = useState<string | null>(null);

  const [status, setStatus] = useState<TransferStatusValue>(transfer.status);
  const [plannedDate, setPlannedDate] = useState<string>(
    transfer.planned_date ?? "",
  );
  const [actualDate, setActualDate] = useState<string>(
    transfer.actual_date ?? "",
  );
  const [countMale, setCountMale] = useState<string>(
    transfer.count_male != null ? String(transfer.count_male) : "",
  );
  const [countFemale, setCountFemale] = useState<string>(
    transfer.count_female != null ? String(transfer.count_female) : "",
  );
  const [countUnsexed, setCountUnsexed] = useState<string>(
    transfer.count_unsexed != null ? String(transfer.count_unsexed) : "",
  );
  const [cites, setCites] = useState<string>(transfer.cites_reference);
  const [notes, setNotes] = useState<string>(transfer.notes);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTransientError(null);
    const parseInt = (s: string): number | null =>
      s.trim() === "" ? null : Number.isFinite(Number(s)) ? Math.trunc(Number(s)) : null;
    const input: TransferDraftInput = {
      species: transfer.species.id,
      source_institution: transfer.source_institution.id,
      destination_institution: transfer.destination_institution.id,
      status,
      proposed_date: transfer.proposed_date,
      planned_date: plannedDate,
      actual_date: actualDate,
      count_male: parseInt(countMale),
      count_female: parseInt(countFemale),
      count_unsexed: parseInt(countUnsexed),
      cites_reference: cites,
      notes,
    };
    startTransition(async () => {
      const result = await updateTransferDraftAction(transfer.id, input);
      if (result.ok) {
        onClose();
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

  return (
    <li className="rounded border border-sky-300 bg-white p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-lg italic text-slate-900">
            {transfer.species.scientific_name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:underline"
          >
            {t("edit.cancel")}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {transfer.source_institution.name} → {transfer.destination_institution.name}
        </p>
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
          <SelectField
            id="edit_status"
            label={t("edit.status")}
            value={status}
            onChange={(v) => setStatus(v as TransferStatusValue)}
            options={STATUSES.map((s) => ({
              value: s,
              label: t(`statuses.${s}`),
            }))}
            error={errors.status}
          />
          <TextField
            id="edit_planned"
            label={t("edit.plannedDate")}
            type="date"
            value={plannedDate}
            onChange={setPlannedDate}
            error={errors.planned_date}
          />
          <TextField
            id="edit_actual"
            label={t("edit.actualDate")}
            type="date"
            value={actualDate}
            onChange={setActualDate}
            error={errors.actual_date}
          />
          <TextField
            id="edit_cites"
            label={t("edit.citesReference")}
            value={cites}
            onChange={setCites}
            error={errors.cites_reference}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <TextField
            id="edit_count_male"
            label={t("edit.countMale")}
            type="number"
            value={countMale}
            onChange={setCountMale}
            error={errors.count_male}
          />
          <TextField
            id="edit_count_female"
            label={t("edit.countFemale")}
            type="number"
            value={countFemale}
            onChange={setCountFemale}
            error={errors.count_female}
          />
          <TextField
            id="edit_count_unsexed"
            label={t("edit.countUnsexed")}
            type="number"
            value={countUnsexed}
            onChange={setCountUnsexed}
            error={errors.count_unsexed}
          />
        </div>
        <div>
          <label
            htmlFor="edit_notes"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            {t("edit.notes")}
          </label>
          <textarea
            id="edit_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t("edit.saving") : t("edit.save")}
          </button>
        </div>
      </form>
    </li>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: "text" | "number" | "date";
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
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
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
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
