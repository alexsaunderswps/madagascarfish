/**
 * Genus silhouette cascade — server helper.
 *
 * Profile pages call this when `Species.silhouette_svg` is empty AND the
 * serializer reports `genus_fk.has_silhouette === true`. The list/card
 * surfaces never call it (perf: one extra fetch per card would multiply).
 */

import { ApiError, apiFetch } from "./api";

export interface GenusSilhouette {
  svg: string;
  credit: string;
}

export async function fetchGenusSilhouette(
  name: string,
): Promise<GenusSilhouette | null> {
  try {
    return await apiFetch<GenusSilhouette>(
      `/api/v1/genera/${encodeURIComponent(name)}/silhouette/`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    return null;
  }
}
