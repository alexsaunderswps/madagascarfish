import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { getServerDrfToken } from "@/lib/auth";
import { fetchFieldPrograms } from "@/lib/institutionDashboard";
import type { MeResponse } from "@/lib/me";

import FieldProgramsView from "./FieldProgramsView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("dashboard.institution.fieldPrograms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function FieldProgramsPage() {
  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    redirect("/login?callbackUrl=/dashboard/institution/field-programs");
  }
  let me: MeResponse | null = null;
  try {
    me = await apiFetch<MeResponse>("/api/v1/auth/me/", {
      authToken: drfToken,
      revalidate: 0,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?callbackUrl=/dashboard/institution/field-programs");
    }
    throw error;
  }
  if (!me) redirect("/account");
  const tier = me.access_tier;
  const claim = me.institution_membership;
  const isCoordinator = tier >= 3;
  const isApprovedKeeper = claim?.claim_status === "approved";
  if (!isCoordinator && !isApprovedKeeper) redirect("/account");

  const userInstitutionId = me.institution ?? null;
  const programs = await fetchFieldPrograms(drfToken);
  // Filter client-side: programs led by my institution OR partnered with it.
  const mine = programs
    ? programs.results.filter((p) => {
        if (userInstitutionId == null) return false;
        if (p.lead_institution?.id === userInstitutionId) return true;
        return p.partner_institutions.some((pi) => pi.id === userInstitutionId);
      })
    : [];

  return (
    <FieldProgramsView
      programs={programs}
      myProgramIds={new Set(mine.map((p) => p.id))}
      myInstitutionId={userInstitutionId}
    />
  );
}
