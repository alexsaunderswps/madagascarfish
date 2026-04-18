#!/usr/bin/env bash
# Warm the ISR cache for the canonical workshop-demo URLs.
#
# Run immediately after a "Revalidate public pages" admin action so the first
# session visitor hits a warm page, not a cold revalidate.
#
# Usage:
#   BASE_URL=https://staging.example.com ./frontend/scripts/warm-cache.sh
#   BASE_URL=http://localhost:3000 ./frontend/scripts/warm-cache.sh
#
# No external dependencies beyond curl.
set -euo pipefail

BASE_URL="${BASE_URL:-}"
if [[ -z "${BASE_URL}" ]]; then
  echo "BASE_URL environment variable is required" >&2
  echo "example: BASE_URL=https://staging.example.com $0" >&2
  exit 2
fi

# Strip trailing slash for consistent joins.
BASE_URL="${BASE_URL%/}"

PATHS=(
  "/"
  "/dashboard/"
  "/species/"
  "/species/?iucn_status=CR,EN"
  "/map/"
  "/about/"
)

# Pull a representative sample of species profile URLs from the API so cold-ISR
# on a profile page can't ambush the first visitor post-revalidate. Uses the
# public API origin (API_BASE_URL) if set; otherwise derives it from BASE_URL by
# swapping the leading host segment (staging.* -> api.*). Falls back to skipping
# profile warming if the species list can't be fetched — the base paths still
# warm and the script exits non-zero only on HTTP failures below.
API_BASE_URL="${API_BASE_URL:-}"
if [[ -z "${API_BASE_URL}" ]]; then
  API_BASE_URL="$(echo "${BASE_URL}" | sed -E 's#//(staging|www)\.#//api.#')"
fi
profile_limit="${PROFILE_WARM_COUNT:-8}"
species_json="$(curl -sS "${API_BASE_URL}/api/v1/species/?page_size=${profile_limit}" || echo '')"
if [[ -n "${species_json}" ]]; then
  # Extract "id":N fields with grep+cut — no jq dependency.
  while read -r id; do
    [[ -n "${id}" ]] && PATHS+=("/species/${id}/")
  done < <(echo "${species_json}" | grep -oE '"id":[0-9]+' | cut -d: -f2 | head -n "${profile_limit}")
else
  echo "warm-cache: could not fetch species list from ${API_BASE_URL}; skipping profile URLs" >&2
fi

fail=0
for path in "${PATHS[@]}"; do
  url="${BASE_URL}${path}"
  # -o /dev/null silences body; -w gives status + time; -L follows redirects.
  result="$(curl -sS -L -o /dev/null -w '%{http_code} %{time_total}s' "${url}" || echo 'curl-failed')"
  status="${result%% *}"
  case "${status}" in
    2??|3??)
      echo "OK   ${result}  ${url}"
      ;;
    *)
      echo "FAIL ${result}  ${url}" >&2
      fail=$((fail + 1))
      ;;
  esac
done

if (( fail > 0 )); then
  echo "warm-cache: ${fail} URL(s) failed" >&2
  exit 1
fi

echo "warm-cache: all ${#PATHS[@]} URLs warmed"
