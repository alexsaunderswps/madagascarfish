"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getServerDrfToken } from "@/lib/auth";
import {
  type BreedingEventType,
  createBreedingEvent,
} from "@/lib/institutionDashboard";

export type LogBreedingEventResult =
  | { ok: true }
  | { ok: false; errors: LogBreedingEventErrors }
  | { ok: false; transientError: string };

export interface LogBreedingEventErrors {
  population?: string;
  event_type?: string;
  event_date?: string;
  count_delta_male?: string;
  count_delta_female?: string;
  count_delta_unsexed?: string;
  notes?: string;
  form?: string;
}

interface Input {
  population: number;
  event_type: BreedingEventType;
  event_date: string;
  count_delta_male: number | null;
  count_delta_female: number | null;
  count_delta_unsexed: number | null;
  notes: string;
}

export async function logBreedingEventAction(
  input: Input,
): Promise<LogBreedingEventResult> {
  const t = await getTranslations(
    "dashboard.institution.breedingEvents.actionErrors",
  );

  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    return { ok: false, errors: { form: t("notSignedIn") } };
  }

  const result = await createBreedingEvent(
    {
      population: input.population,
      event_type: input.event_type,
      event_date: input.event_date,
      count_delta_male: input.count_delta_male,
      count_delta_female: input.count_delta_female,
      count_delta_unsexed: input.count_delta_unsexed,
      notes: input.notes,
    },
    drfToken,
  );

  if (result.ok) {
    revalidatePath("/dashboard/institution/breeding-events");
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
  if (error.status === 400 && error.fieldErrors) {
    const errors: LogBreedingEventErrors = {};
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (
        field === "population" ||
        field === "event_type" ||
        field === "event_date" ||
        field === "count_delta_male" ||
        field === "count_delta_female" ||
        field === "count_delta_unsexed" ||
        field === "notes"
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
