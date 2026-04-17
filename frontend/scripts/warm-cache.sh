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
