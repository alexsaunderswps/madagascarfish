"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getServerDrfToken } from "@/lib/auth";
import {
  type TransferStatusValue,
  type TransferWritePayload,
  createTransferDraft,
  updateTransferDraft,
} from "@/lib/coordinatorDashboard";

export type TransferDraftActionResult =
  | { ok: true; id?: number }
  | { ok: false; errors: TransferDraftErrors }
  | { ok: false; transientError: string };

export interface TransferDraftErrors {
  species?: string;
  source_institution?: string;
  destination_institution?: string;
  status?: string;
  proposed_date?: string;
  planned_date?: string;
  actual_date?: string;
  count_male?: string;
  count_female?: string;
  count_unsexed?: string;
  cites_reference?: string;
  notes?: string;
  form?: string;
}

export interface TransferDraftInput {
  species: number;
  source_institution: number;
  destination_institution: number;
  status: TransferStatusValue;
  proposed_date: string;
  planned_date: string;
  actual_date: string;
  count_male: number | null;
  count_female: number | null;
  count_unsexed: number | null;
  cites_reference: string;
  notes: string;
}

function _toPayload(input: TransferDraftInput): TransferWritePayload {
  return {
    species: input.species,
    source_institution: input.source_institution,
    destination_institution: input.destination_institution,
    status: input.status,
    proposed_date: input.proposed_date,
    planned_date: input.planned_date || null,
    actual_date: input.actual_date || null,
    count_male: input.count_male,
    count_female: input.count_female,
    count_unsexed: input.count_unsexed,
    cites_reference: input.cites_reference,
    notes: input.notes,
  };
}

function _mapErrors(errs: Record<string, string[]>): TransferDraftErrors {
  const out: TransferDraftErrors = {};
  const known: (keyof TransferDraftErrors)[] = [
    "species",
    "source_institution",
    "destination_institution",
    "status",
    "proposed_date",
    "planned_date",
    "actual_date",
    "count_male",
    "count_female",
    "count_unsexed",
    "cites_reference",
    "notes",
  ];
  for (const [field, messages] of Object.entries(errs)) {
    if ((known as string[]).includes(field)) {
      out[field as keyof TransferDraftErrors] = messages.join(" ");
    }
  }
  return out;
}

async function _common(
  errorTKey: string,
): Promise<{ token: string } | TransferDraftActionResult> {
  const t = await getTranslations(errorTKey);
  const token = await getServerDrfToken();
  if (!token) return { ok: false, errors: { form: t("notSignedIn") } };
  return { token };
}

export async function createTransferDraftAction(
  input: TransferDraftInput,
): Promise<TransferDraftActionResult> {
  const t = await getTranslations(
    "dashboard.coordinator.transferDrafts.actionErrors",
  );
  const guard = await _common("dashboard.coordinator.transferDrafts.actionErrors");
  if (!("token" in guard)) return guard;
  if (input.source_institution === input.destination_institution) {
    return {
      ok: false,
      errors: { destination_institution: t("sameInstitution") },
    };
  }
  const result = await createTransferDraft(_toPayload(input), guard.token);
  if (result.ok) {
    revalidatePath("/dashboard/coordinator/transfers");
    return { ok: true, id: result.id };
  }
  const e = result.error;
  if (e.status === 401) return { ok: false, errors: { form: t("notSignedIn") } };
  if (e.status === 403) return { ok: false, errors: { form: t("forbidden") } };
  if (e.status === 400 && e.fieldErrors) {
    const mapped = _mapErrors(e.fieldErrors);
    if (Object.keys(mapped).length === 0) {
      mapped.form = e.detail || t("badRequest");
    }
    return { ok: false, errors: mapped };
  }
  return { ok: false, transientError: e.detail || t("transientError") };
}

export async function updateTransferDraftAction(
  id: number,
  input: TransferDraftInput,
): Promise<TransferDraftActionResult> {
  const t = await getTranslations(
    "dashboard.coordinator.transferDrafts.actionErrors",
  );
  const guard = await _common("dashboard.coordinator.transferDrafts.actionErrors");
  if (!("token" in guard)) return guard;
  const result = await updateTransferDraft(id, _toPayload(input), guard.token);
  if (result.ok) {
    revalidatePath("/dashboard/coordinator/transfers");
    return { ok: true, id };
  }
  const e = result.error;
  if (e.status === 401) return { ok: false, errors: { form: t("notSignedIn") } };
  if (e.status === 403) return { ok: false, errors: { form: t("forbidden") } };
  if (e.status === 404) return { ok: false, errors: { form: t("notFound") } };
  if (e.status === 400 && e.fieldErrors) {
    const mapped = _mapErrors(e.fieldErrors);
    if (Object.keys(mapped).length === 0) {
      mapped.form = e.detail || t("badRequest");
    }
    return { ok: false, errors: mapped };
  }
  return { ok: false, transientError: e.detail || t("transientError") };
}
