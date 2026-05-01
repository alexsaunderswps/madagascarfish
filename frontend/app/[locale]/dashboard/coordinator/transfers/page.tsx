import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { getServerDrfToken, getServerTier } from "@/lib/auth";
import { fetchTransferDrafts } from "@/lib/coordinatorDashboard";

import TransferDraftsView from "./TransferDraftsView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("dashboard.coordinator.transferDrafts");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

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
interface PaginatedSpecies {
  results: SpeciesBrief[];
  next: string | null;
}
interface PaginatedInstitutions {
  results: InstitutionBrief[];
  next: string | null;
}

async function _fetchAll<T>(path: string, pageSize = 200): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = `${path}?page_size=${pageSize}`;
  let safety = 50;
  while (next && safety-- > 0) {
    let resp: { results: T[]; next: string | null };
    try {
      resp = await apiFetch<{ results: T[]; next: string | null }>(next);
    } catch {
      break;
    }
    out.push(...resp.results);
    next = resp.next;
    if (next) {
      try {
        const u = new URL(next);
        next = `${u.pathname}${u.search}`;
      } catch {
        /* relative */
      }
    }
  }
  return out;
}

export default async function CoordinatorTransfersPage() {
  // Tier 3+ gate. Middleware already redirects sub-tier-3 to /login,
  // but defense-in-depth.
  const tier = await getServerTier();
  if (typeof tier !== "number" || tier < 3) {
    redirect("/login?callbackUrl=/dashboard/coordinator/transfers");
  }

  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    redirect("/login?callbackUrl=/dashboard/coordinator/transfers");
  }

  const [transfers, species, institutions] = await Promise.all([
    fetchTransferDrafts(drfToken),
    _fetchAll<SpeciesBrief>("/api/v1/species/"),
    _fetchAll<InstitutionBrief>("/api/v1/institutions/"),
  ]);

  return (
    <TransferDraftsView
      transfers={transfers}
      species={species}
      institutions={institutions}
    />
  );
}

export type { SpeciesBrief, InstitutionBrief };
export type { PaginatedSpecies, PaginatedInstitutions };
