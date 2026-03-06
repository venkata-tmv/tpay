from __future__ import annotations

from typing import Any

from app.mcp.servicetitan_analytics.explorer.catalog_loader import load_catalog
from app.mcp.servicetitan_analytics.guardrails import (
    enforce_allowed_params,
    redact_pii,
)
from app.mcp.servicetitan_analytics.st_client import get_mcp_st_client
from app.mcp.servicetitan_analytics.config import get_mcp_st_settings


def st_get(
    endpoint: str,
    params: dict[str, Any] | None = None,
) -> dict:
    """
    Generic read-only explorer for ServiceTitan endpoints defined in catalog.
    """

    catalog = load_catalog()

    if endpoint not in catalog:
        raise ValueError(f"Endpoint '{endpoint}' not defined in catalog")

    endpoint_def = catalog[endpoint]

    params = params or {}

    # Validate parameters
    params = enforce_allowed_params(params, endpoint_def.allowed_params)

    settings = get_mcp_st_settings()
    client = get_mcp_st_client()

    path = endpoint_def.path.format(tenant_id=settings.tenant_id)

    result = client.get_paginated(
        path=path,
        params=params,
        items_key=endpoint_def.items_key,
        page_size=endpoint_def.default_page_size,
        max_rows=settings.max_rows,
    )

    rows = result.get("data", [])

    # Apply PII redaction
    rows = redact_pii(rows, pii_fields=endpoint_def.pii_fields)

    return {
        "endpoint": endpoint,
        "rows": rows,
        "meta": result.get("meta", {}),
    }