from __future__ import annotations

import logging
import time
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class IUCNAPIError(Exception):
    """Raised for non-404 HTTP errors from the IUCN Red List API."""


class IUCNClient:
    """Wraps the IUCN Red List API v4.

    Redis-backed response cache (7-day TTL) avoids hammering the API on
    repeated reads. Rate limiting is caller-paced: `wait_between_requests`
    sleeps one second only after a live API call, never after a cache hit.
    """

    def __init__(
        self,
        token: str | None = None,
        base_url: str | None = None,
        timeout: int | None = None,
        cache_ttl: int | None = None,
    ) -> None:
        self.token = token if token is not None else settings.IUCN_API_TOKEN
        self.base_url = (base_url or settings.IUCN_API_BASE_URL).rstrip("/")
        self.timeout = timeout if timeout is not None else settings.IUCN_REQUEST_TIMEOUT_SECONDS
        self.cache_ttl = cache_ttl if cache_ttl is not None else settings.IUCN_CACHE_TTL_SECONDS
        self.last_request_was_cache_hit: bool = False

    def get_species_assessment(self, iucn_taxon_id: int) -> dict[str, Any] | None:
        """Fetch the SIS taxon summary (includes latest + historic assessment IDs).

        Returns None on 404. Call `get_assessment()` with an assessment_id from
        the returned payload to retrieve full assessment detail.
        """
        cache_key = f"iucn:taxa:sis:{int(iucn_taxon_id)}"
        return self._get_cached(
            cache_key,
            path=f"/taxa/sis/{int(iucn_taxon_id)}",
        )

    def get_species_by_name(self, scientific_name: str) -> dict[str, Any] | None:
        """Look up a taxon by scientific name (binomial or trinomial).

        Splits the input into genus/species (+ optional infra) and passes them
        as query parameters. Returns None on 404.
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

    def get_assessment(self, assessment_id: int) -> dict[str, Any] | None:
        """Fetch full assessment detail by assessment_id. Returns None on 404."""
        cache_key = f"iucn:assessment:{int(assessment_id)}"
        return self._get_cached(
            cache_key,
            path=f"/assessment/{int(assessment_id)}",
        )

    def wait_between_requests(self) -> None:
        """Sleep to respect the 1 req/sec rate limit. Call only after a live hit."""
        time.sleep(1)

    def _get_cached(
        self,
        cache_key: str,
        path: str,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any] | None:
        cached = cache.get(cache_key)
        if cached is not None:
            self.last_request_was_cache_hit = True
            return cached if cached != "__NOT_FOUND__" else None

        self.last_request_was_cache_hit = False
        data = self._request(path, params=params)
        cache.set(
            cache_key,
            data if data is not None else "__NOT_FOUND__",
            timeout=self.cache_ttl,
        )
        return data

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
            raise IUCNAPIError(
                f"IUCN API returned {response.status_code} for {path}: {response.text[:200]}"
            )

        try:
            return response.json()
        except ValueError as exc:
            raise IUCNAPIError(f"IUCN API returned non-JSON response: {exc}") from exc
