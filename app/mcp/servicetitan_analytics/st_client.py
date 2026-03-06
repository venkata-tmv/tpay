from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.mcp.servicetitan_analytics.config import (
    MCPServiceTitanSettings,
    get_mcp_st_settings,
)


class MCPServiceTitanClientError(Exception):
    pass


class MCPServiceTitanAuthError(MCPServiceTitanClientError):
    pass


class MCPServiceTitanRequestError(MCPServiceTitanClientError):
    pass


class MCPServiceTitanRowLimitError(MCPServiceTitanClientError):
    pass


@dataclass
class _TokenCache:
    access_token: str | None = None
    expires_at: datetime | None = None

    def is_valid(self) -> bool:
        if not self.access_token or not self.expires_at:
            return False
        return datetime.now(timezone.utc) < self.expires_at


class MCPServiceTitanClient:
    """
    Read-only ServiceTitan client for MCP analytics use cases.

    Important differences from the existing TPay ServiceTitan client:
    - Uses separate MCP credentials/settings
    - Maintains its own token cache
    - Exposes GET-only operations
    - Supports pagination and row caps
    """

    def __init__(self, settings: MCPServiceTitanSettings | None = None) -> None:
        self.settings = settings or get_mcp_st_settings()
        self._token_cache = _TokenCache()
        self._client = httpx.Client()

    def _get_access_token(self) -> str:
        if self._token_cache.is_valid():
            return self._token_cache.access_token  # type: ignore[return-value]

        response = self._client.post(
            self.settings.normalized_token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self.settings.client_id,
                "client_secret": self.settings.client_secret,
            },
            timeout=self.settings.token_timeout_seconds,
        )

        if response.status_code >= 400:
            raise MCPServiceTitanAuthError(
                f"Failed to obtain ServiceTitan access token: "
                f"{response.status_code} {response.text}"
            )

        payload = response.json()
        access_token = payload.get("access_token")
        expires_in = payload.get("expires_in", 3600)

        if not access_token:
            raise MCPServiceTitanAuthError(
                "Token response did not include access_token"
            )

        try:
            expires_in_int = int(expires_in)
        except (TypeError, ValueError):
            expires_in_int = 3600

        # Refresh a bit early to avoid edge-expiry failures.
        safe_ttl = max(60, expires_in_int - 60)

        self._token_cache.access_token = access_token
        self._token_cache.expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=safe_ttl
        )

        return access_token

    def _build_url(self, path: str) -> str:
        clean_path = path.strip()
        if not clean_path.startswith("/"):
            clean_path = f"/{clean_path}"
        return f"{self.settings.normalized_api_base_url}{clean_path}"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._get_access_token()}",
            "ST-App-Key": self.settings.app_key,
            "Accept": "application/json",
        }

    def get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Perform a GET request against a ServiceTitan API path.
        """
        response = self._client.get(
            self._build_url(path),
            headers=self._headers(),
            params=params or {},
            timeout=self.settings.request_timeout_seconds,
        )

        if response.status_code >= 400:
            raise MCPServiceTitanRequestError(
                f"ServiceTitan GET failed for {path}: "
                f"{response.status_code} {response.text}"
            )

        content_type = response.headers.get("Content-Type", "")
        if "application/json" not in content_type.lower():
            raise MCPServiceTitanRequestError(
                f"Expected JSON response from {path}, got Content-Type={content_type}"
            )

        data = response.json()
        if isinstance(data, dict):
            return data

        # Normalize list-style responses into a dict wrapper.
        return {"data": data}

    def get_paginated(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        items_key: str = "data",
        page_param: str = "page",
        page_size_param: str = "pageSize",
        page_size: int | None = None,
        max_rows: int | None = None,
        start_page: int = 1,
    ) -> dict[str, Any]:
        """
        Fetch paginated results and stop at max_rows.

        Returns:
        {
            "data": [...],
            "meta": {
                "pages_fetched": 3,
                "rows_returned": 412,
                "truncated": false,
                "next_page": None
            }
        }
        """
        effective_page_size = page_size or self.settings.default_page_size
        effective_max_rows = max_rows or self.settings.max_rows

        if effective_page_size <= 0:
            raise MCPServiceTitanClientError("page_size must be > 0")
        if effective_max_rows <= 0:
            raise MCPServiceTitanClientError("max_rows must be > 0")

        collected: list[dict[str, Any]] = []
        current_page = start_page
        pages_fetched = 0
        truncated = False
        next_page: int | None = None

        base_params = dict(params or {})
        total_limit = effective_max_rows

        while True:
            page_params = dict(base_params)
            page_params[page_param] = current_page
            page_params[page_size_param] = effective_page_size

            payload = self.get(path=path, params=page_params)
            pages_fetched += 1

            items = payload.get(items_key, [])
            if items is None:
                items = []

            if not isinstance(items, list):
                raise MCPServiceTitanRequestError(
                    f"Expected list in payload key '{items_key}' for {path}"
                )

            remaining = total_limit - len(collected)
            if remaining <= 0:
                truncated = True
                next_page = current_page
                break

            if len(items) > remaining:
                collected.extend(items[:remaining])
                truncated = True
                next_page = current_page
                break

            collected.extend(items)

            # Stop if final page
            if len(items) < effective_page_size:
                break

            current_page += 1

        return {
            "data": collected,
            "meta": {
                "pages_fetched": pages_fetched,
                "rows_returned": len(collected),
                "truncated": truncated,
                "next_page": next_page,
                "page_size": effective_page_size,
                "max_rows": total_limit,
            },
        }


_client_instance: MCPServiceTitanClient | None = None


def get_mcp_st_client() -> MCPServiceTitanClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = MCPServiceTitanClient()
    return _client_instance