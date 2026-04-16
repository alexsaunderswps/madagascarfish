from __future__ import annotations

import logging
import time
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

ALLOWED_BASE_URL_PREFIXES = ("https://api.iucnredlist.org",)
_CACHE_NOT_FOUND = "__NOT_FOUND__"


class IUCNAPIError(Exception):
    """Raised for non-404 HTTP errors from the IUCN Red List API."""


class IUCNClient:
    """Wraps the IUCN Red List API v4.

    Redis-backed response cache (7-day TTL) avoids hammering the API on
    repeated reads. Public methods return ``(data, cache_hit)`` so callers
    can decide whether to apply the 1 req/sec rate-limit sleep. Use
    :meth:`wait_between_requests` only when ``cache_hit`` is False.
    """

    def __init__(
        self,
        token: str | None = None,
        base_url: str | None = None,
        timeout: int | None = None,
        cache_ttl: int | None = None,
    ) -> None:
        self.token = token if token is not None else settings.IUCN_API_TOKEN
        resolved_base = (base_url or settings.IUCN_API_BASE_URL).rstrip("/")
        if not any(resolved_base.startswith(prefix) for prefix in ALLOWED_BASE_URL_PREFIXES):
            raise IUCNAPIError(
                f"IUCN base_url must start with one of {ALLOWED_BASE_URL_PREFIXES}; got {resolved_base!r}"
            )
        self.base_url = resolved_base
        self.timeout = timeout if timeout is not None else settings.IUCN_REQUEST_TIMEOUT_SECONDS
        self.cache_ttl = cache_ttl if cache_ttl is not None else settings.IUCN_CACHE_TTL_SECONDS

    def get_species_assessment(
        self, iucn_taxon_id: int
    ) -> tuple[dict[str, Any] | None, bool]:
        """Fetch the SIS taxon summary (includes latest + historic assessment IDs).

        Returns ``(payload, cache_hit)``. ``payload`` is None on 404.
        """
        cache_key = f"iucn:taxa:sis:{int(iucn_taxon_id)}"
        return self._get_cached(cache_key, path=f"/taxa/sis/{int(iucn_taxon_id)}")

    def get_species_by_name(
        self, scientific_name: str
    ) -> tuple[dict[str, Any] | None, bool]:
        """Look up a taxon by scientific name (binomial or trinomial).

        Returns ``(payload, cache_hit)``. ``payload`` is None on 404.
        """
        parts = scientific_name.strip().split()
        if len(parts) < 2:
            raise IUCNAPIError(
                f"scientific_name must be a binomial or trinomial: {scientific_name!r}"
            )
        params: dict[str, str] = {"genus_name": parts[0], "species_name": parts[1]}
        if len(parts) >= 3:
            params["infra_name"] = " ".join(parts[2:])

        cache_key = f"iucn:taxa:name:{scientific_name.lower()}"
        return self._get_cached(cache_key, path="/taxa/scientific_name", params=params)

    def get_assessment(
        self, assessment_id: int
    ) -> tuple[dict[str, Any] | None, bool]:
        """Fetch full assessment detail by assessment_id.

        Returns ``(payload, cache_hit)``. ``payload`` is None on 404.
        """
        cache_key = f"iucn:assessment:{int(assessment_id)}"
        return self._get_cached(cache_key, path=f"/assessment/{int(assessment_id)}")

    def wait_between_requests(self) -> None:
        """Sleep to respect the 1 req/sec rate limit. Call only after a live hit."""
        time.sleep(1)

    def _get_cached(
        self,
        cache_key: str,
        path: str,
        params: dict[str, str] | None = None,
    ) -> tuple[dict[str, Any] | None, bool]:
        cached = cache.get(cache_key)
        if cached is not None:
            return (None if cached == _CACHE_NOT_FOUND else cached), True

        data = self._request(path, params=params)
        cache.set(cache_key, data if data is not None else _CACHE_NOT_FOUND, timeout=self.cache_ttl)
        return data, False

    def _request(
        self,
        path: str,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any] | None:
        if not self.token:
            raise IUCNAPIError("IUCN_API_TOKEN is not configured")

        url = f"{self.base_url}{path}"
        try:
            response = requests.get(
                url,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Accept": "application/json",
                },
                params=params,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise IUCNAPIError(f"IUCN API request failed: {exc}") from exc

        if response.status_code == 404:
            return None
        if not response.ok:
            logger.debug(
                "IUCN API %s for %s: %s", response.status_code, path, response.text[:200]
            )
            raise IUCNAPIError(f"IUCN API returned {response.status_code} for {path}")

        try:
            return response.json()
        except ValueError as exc:
            raise IUCNAPIError(f"IUCN API returned non-JSON response: {exc}") from exc
