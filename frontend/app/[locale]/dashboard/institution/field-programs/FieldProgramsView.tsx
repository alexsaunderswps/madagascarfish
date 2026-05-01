"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  FieldProgramListResponse,
  FieldProgramRow,
  FieldProgramStatus,
} from "@/lib/institutionDashboard";

import {
  type FieldProgramErrors,
  createFieldProgramAction,
  updateFieldProgramAction,
} from "./actions";

const STATUSES: FieldProgramStatus[] = ["planned", "active", "completed"];

export default function FieldProgramsView({
  programs,
  myProgramIds,
  myInstitutionId,
}: {
  programs: FieldProgramListResponse | null;
  myProgramIds: Set<number>;
  myInstitutionId: number | null;
}) {
  const t = useTranslations("dashboard.institution.fieldPrograms");
  const myPrograms = programs?.results.filter((p) => myProgramIds.has(p.id)) ?? [];
  const otherPrograms =
    programs?.results.filter((p) => !myProgramIds.has(p.id)) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">{t("title")}</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">{t("subtitle")}</p>
      </header>

      {programs === null ? (
        <p
          role="alert"
          className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {t("transientError")}
        </p>
      ) : (
        <>
          <CreateForm />

          <section className="mt-10">
            <h2 className="mb-3 font-serif text-xl text-slate-900">
              {t("mine.heading")}
            </h2>
            {myPrograms.length === 0 ? (
              <p className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {t("mine.empty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {myPrograms.map((p) => (
                  <ProgramCard
                    key={p.id}
                    program={p}
                    canEdit={p.lead_institution?.id === myInstitutionId}
                  />
                ))}
              </ul>
            )}
          </section>

          {otherPrograms.length > 0 ? (
            <section className="mt-10">
              <h2 className="mb-3 font-serif text-xl text-slate-900">
                {t("others.heading")}
              </h2>
              <ul className="space-y-3">
                {otherPrograms.map((p) => (
                  <ProgramCard key={p.id} program={p} canEdit={false} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function CreateForm() {
  const t = useTranslations("dashboard.institution.fieldPrograms");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<FieldProgramErrors>({});
  const [transientError, setTransientError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState<FieldProgramStatus>("planned");
  const [startDate, setStartDate] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTransientError(null);
    startTransition(async () => {
      const result = await createFieldProgramAction({
        name,
        description,
        region,
        status,
        start_date: startDate,
        end_date: "",
        funding_sources: "",
        website: "",
      });
      if (result.ok) {
        setName("");
        setDescription("");
        setRegion("");
        setStartDate("");
        setStatus("planned");
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
        <h2 className="font-serif text-xl text-slate-900">{t("createForm.heading")}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 underline-offset-2 hover:underline"
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

      <FieldText
        id="name"
        label={t("createForm.name")}
        value={name}
        onChange={setName}
        error={errors.name}
        required
      />
      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
        >
          {t("createForm.description")}
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
        />
        {errors.description ? (
          <p className="mt-1 text-xs text-red-600">{errors.description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FieldText
          id="region"
          label={t("createForm.region")}
          value={region}
          onChange={setRegion}
          error={errors.region}
        />
        <div>
          <label
            htmlFor="status"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            {t("createForm.status")}
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as FieldProgramStatus)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FieldText
        id="start_date"
        label={t("createForm.startDate")}
        type="date"
        value={startDate}
        onChange={setStartDate}
        error={errors.start_date}
      />

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

function ProgramCard({
  program,
  canEdit,
}: {
  program: FieldProgramRow;
  canEdit: boolean;
}) {
  const t = useTranslations("dashboard.institution.fieldPrograms");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <EditForm program={program} onClose={() => setEditing(false)} />;
  }

  return (
    <li className="rounded border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg text-slate-900">{program.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {program.lead_institution?.name ?? t("card.noLead")} ·{" "}
            {t(`statuses.${program.status}`)}
            {program.region ? ` · ${program.region}` : ""}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-sky-700 underline underline-offset-2 hover:text-sky-900"
          >
            {t("card.edit")}
          </button>
        ) : null}
      </div>
      {program.description ? (
        <p className="mt-3 text-sm text-slate-700">{program.description}</p>
      ) : null}
      {program.focal_species.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {t("card.focalSpecies")}{" "}
          {program.focal_species.map((s) => s.scientific_name).join(", ")}
        </p>
      ) : null}
    </li>
  );
}

function EditForm({
  program,
  onClose,
}: {
  program: FieldProgramRow;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard.institution.fieldPrograms");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldProgramErrors>({});
  const [transientError, setTransientError] = useState<string | null>(null);

  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description);
  const [region, setRegion] = useState(program.region);
  const [status, setStatus] = useState<FieldProgramStatus>(program.status);
  const [startDate, setStartDate] = useState(program.start_date ?? "");
  const [endDate, setEndDate] = useState(program.end_date ?? "");
  const [funding, setFunding] = useState(program.funding_sources);
  const [website, setWebsite] = useState(program.website);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTransientError(null);
    startTransition(async () => {
      const result = await updateFieldProgramAction(program.id, {
        name,
        description,
        region,
        status,
        start_date: startDate,
        end_date: endDate,
        funding_sources: funding,
        website,
      });
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
          <h3 className="font-serif text-lg text-slate-900">{t("edit.heading")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:underline"
          >
            {t("edit.cancel")}
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

        <FieldText
          id="name"
          label={t("edit.name")}
          value={name}
          onChange={setName}
          error={errors.name}
        />
        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            {t("edit.description")}
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldText
            id="region"
            label={t("edit.region")}
            value={region}
            onChange={setRegion}
            error={errors.region}
          />
          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
            >
              {t("edit.status")}
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as FieldProgramStatus)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <FieldText
            id="start_date"
            label={t("edit.startDate")}
            type="date"
            value={startDate}
            onChange={setStartDate}
            error={errors.start_date}
          />
          <FieldText
            id="end_date"
            label={t("edit.endDate")}
            type="date"
            value={endDate}
            onChange={setEndDate}
            error={errors.end_date}
          />
        </div>
        <div>
          <label
            htmlFor="funding"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            {t("edit.fundingSources")}
          </label>
          <textarea
            id="funding"
            value={funding}
            onChange={(e) => setFunding(e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <FieldText
          id="website"
          label={t("edit.website")}
          value={website}
          onChange={setWebsite}
          error={errors.website}
        />

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

function FieldText({
  id,
  label,
  value,
  onChange,
  error,
  type,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: "text" | "date";
  required?: boolean;
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
        required={required}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
