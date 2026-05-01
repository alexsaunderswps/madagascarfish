import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { getServerDrfToken } from "@/lib/auth";
import { fetchInstitutionPopulationDetail } from "@/lib/institutionDashboard";
import type { MeResponse } from "@/lib/me";

import EditPopulationForm from "./EditPopulationForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("dashboard.institution.edit");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}


export default async function EditPopulationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const populationId = Number(id);
  if (!Number.isFinite(populationId) || populationId <= 0) {
    notFound();
  }

  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    redirect(`/login?callbackUrl=/dashboard/institution/populations/${id}/edit`);
  }

  let me: MeResponse | null = null;
  try {
    me = await apiFetch<MeResponse>("/api/v1/auth/me/", {
      authToken: drfToken,
      revalidate: 0,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(
        `/login?callbackUrl=/dashboard/institution/populations/${id}/edit`,
      );
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

  const population = await fetchInstitutionPopulationDetail(populationId, drfToken);
  if (!population) {
    notFound();
  }

  return <EditPopulationForm population={population} />;
}
