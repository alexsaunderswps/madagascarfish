"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getServerDrfToken } from "@/lib/auth";
import { updateInstitutionPopulation } from "@/lib/institutionDashboard";

export type EditPopulationResult =
  | { ok: true }
  | { ok: false; errors: EditPopulationErrors }
  | { ok: false; transientError: string };

export interface EditPopulationErrors {
  count_total?: string;
  count_male?: string;
  count_female?: string;
  count_unsexed?: string;
  breeding_status?: string;
  last_census_date?: string;
  notes?: string;
  studbook_managed?: string;
  form?: string;
}

interface EditInput {
  populationId: number;
  count_total: number | null;
  count_male: number | null;
  count_female: number | null;
  count_unsexed: number | null;
  breeding_status: "breeding" | "non-breeding" | "unknown";
  last_census_date: string | null;
  notes: string;
  studbook_managed: boolean;
}

export async function editPopulationAction(
  input: EditInput,
): Promise<EditPopulationResult> {
  const t = await getTranslations("dashboard.institution.edit.actionErrors");

  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    return { ok: false, errors: { form: t("notSignedIn") } };
  }

  const result = await updateInstitutionPopulation(
    input.populationId,
    {
      count_total: input.count_total,
      count_male: input.count_male,
      count_female: input.count_female,
      count_unsexed: input.count_unsexed,
      breeding_status: input.breeding_status,
      last_census_date: input.last_census_date,
      notes: input.notes,
      studbook_managed: input.studbook_managed,
    },
    drfToken,
  );

  if (result.ok) {
    revalidatePath("/dashboard/institution");
    return { ok: true };
  }

  const error = result.error;
  if (error.status === 401) {
    return { ok: false, errors: { form: t("notSignedIn") } };
  }
  if (error.status === 403) {
    return { ok: false, errors: { form: t("forbidden") } };
  }
  if (error.status === 404) {
    return { ok: false, errors: { form: t("notFound") } };
  }
  if (error.status === 400 && error.fieldErrors) {
    const errors: EditPopulationErrors = {};
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (
        field === "count_total" ||
        field === "count_male" ||
        field === "count_female" ||
        field === "count_unsexed" ||
        field === "breeding_status" ||
        field === "last_census_date" ||
        field === "notes" ||
        field === "studbook_managed"
      ) {
        errors[field] = messages.join(" ");
      }
    }
    if (Object.keys(errors).length === 0) {
      errors.form = error.detail || t("badRequest");
    }
    return { ok: false, errors };
  }
  return { ok: false, transientError: error.detail || t("transientError") };
}
