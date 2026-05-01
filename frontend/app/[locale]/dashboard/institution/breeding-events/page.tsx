import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { getServerDrfToken } from "@/lib/auth";
import {
  fetchBreedingEvents,
  fetchInstitutionPopulations,
} from "@/lib/institutionDashboard";
import type { MeResponse } from "@/lib/me";

import BreedingEventsView from "./BreedingEventsView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("dashboard.institution.breedingEvents");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function BreedingEventsPage() {
  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    redirect("/login?callbackUrl=/dashboard/institution/breeding-events");
  }

  let me: MeResponse | null = null;
  try {
    me = await apiFetch<MeResponse>("/api/v1/auth/me/", {
      authToken: drfToken,
      revalidate: 0,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?callbackUrl=/dashboard/institution/breeding-events");
    }
    throw error;
  }

  if (!me) {
    redirect("/account");
  }
  const tier = me.access_tier;
  const claim = me.institution_membership;
  const isCoordinator = tier >= 3;
  const isApprovedKeeper = claim?.claim_status === "approved";
  if (!isCoordinator && !isApprovedKeeper) {
    redirect("/account");
  }

  const [events, populations] = await Promise.all([
    fetchBreedingEvents(drfToken),
    fetchInstitutionPopulations(drfToken),
  ]);

  return (
    <BreedingEventsView
      events={events}
      populations={populations?.results ?? []}
    />
  );
}
