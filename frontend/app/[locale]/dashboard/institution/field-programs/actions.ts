"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getServerDrfToken } from "@/lib/auth";
import {
  type FieldProgramStatus,
  type FieldProgramWritePayload,
  createFieldProgram,
  updateFieldProgram,
} from "@/lib/institutionDashboard";

export type FieldProgramActionResult =
  | { ok: true; id?: number }
  | { ok: false; errors: FieldProgramErrors }
  | { ok: false; transientError: string };

export interface FieldProgramErrors {
  name?: string;
  description?: string;
  region?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  funding_sources?: string;
  website?: string;
  form?: string;
}

interface InputBase {
  name: string;
  description: string;
  region: string;
  status: FieldProgramStatus;
  start_date: string;
  end_date: string;
  funding_sources: string;
  website: string;
}

function _toPayload(input: InputBase): FieldProgramWritePayload {
  return {
    name: input.name.trim(),
    description: input.description,
    region: input.region.trim(),
    status: input.status,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    funding_sources: input.funding_sources,
    website: input.website.trim(),
  };
}

async function _common(
  errorTKey: string,
): Promise<{ token: string } | FieldProgramActionResult> {
  const t = await getTranslations(errorTKey);
  const token = await getServerDrfToken();
  if (!token) return { ok: false, errors: { form: t("notSignedIn") } };
  return { token };
}

function _mapErrors(
  errs: Record<string, string[]>,
): FieldProgramErrors {
  const out: FieldProgramErrors = {};
  for (const [field, messages] of Object.entries(errs)) {
    if (
      field === "name" ||
      field === "description" ||
      field === "region" ||
      field === "status" ||
      field === "start_date" ||
      field === "end_date" ||
      field === "funding_sources" ||
      field === "website"
    ) {
      out[field] = messages.join(" ");
    }
  }
  return out;
}

export async function createFieldProgramAction(
  input: InputBase,
): Promise<FieldProgramActionResult> {
  const t = await getTranslations(
    "dashboard.institution.fieldPrograms.actionErrors",
  );
  const guard = await _common("dashboard.institution.fieldPrograms.actionErrors");
  if (!("token" in guard)) return guard;
  const result = await createFieldProgram(_toPayload(input), guard.token);
  if (result.ok) {
    revalidatePath("/dashboard/institution/field-programs");
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

export async function updateFieldProgramAction(
  id: number,
  input: InputBase,
): Promise<FieldProgramActionResult> {
  const t = await getTranslations(
    "dashboard.institution.fieldPrograms.actionErrors",
  );
  const guard = await _common("dashboard.institution.fieldPrograms.actionErrors");
  if (!("token" in guard)) return guard;
  const result = await updateFieldProgram(id, _toPayload(input), guard.token);
  if (result.ok) {
    revalidatePath("/dashboard/institution/field-programs");
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
