import { apiFetch } from "./api";

export interface DashboardResponse {
  species_counts: {
    total: number;
    described: number;
    undescribed: number;
    by_iucn_status: Record<string, number>;
  };
  ex_situ_coverage: {
    threatened_species_total: number;
    threatened_species_with_captive_population: number;
    threatened_species_without_captive_population: number;
    institutions_active: number;
    total_populations_tracked: number;
  };
  field_programs: {
    active: number;
    planned: number;
    completed: number;
  };
  // Optional during the v1 → v2 rollout: backend deployments that haven't
  // picked up the new payload shape will omit this block. The /dashboard/
  // page page falls back to a zero shape when undefined.
  coordination?: {
    active_programs_total: number;
    active_programs_by_type: Record<string, number>;
    transfer_window_days: number;
    transfers_in_flight: number;
    transfers_recent_completed: number;
  };
  last_updated: string;
  last_sync_at: string | null;
}

export async function fetchDashboard(): Promise<DashboardResponse | null> {
  try {
    return await apiFetch<DashboardResponse>("/api/v1/dashboard/");
  } catch {
    return null;
  }
}
