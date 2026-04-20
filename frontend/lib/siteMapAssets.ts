/**
 * Site map asset cascade — server helper.
 *
 * Home and profile pages call this to resolve a curated map thumbnail by slot.
 * A missing row or unuploaded image returns null so the caller can render the
 * stripe fallback instead of a broken <img>.
 *
 * Slots are typed against the backend enum — adding a new slot requires a new
 * SiteMapAsset row + an edit here.
 */

import { ApiError, apiFetch } from "./api";

export type SiteMapAssetSlot = "hero_thumb" | "profile_panel";

export interface SiteMapAsset {
  url: string;
  alt: string;
  credit: string;
  width: number;
  height: number;
}

export async function fetchSiteMapAsset(
  slot: SiteMapAssetSlot,
): Promise<SiteMapAsset | null> {
  try {
    return await apiFetch<SiteMapAsset>(`/api/v1/site-map-assets/${slot}/`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    return null;
  }
}
