from __future__ import annotations

from app.mcp.servicetitan_analytics.explorer.catalog_loader import load_catalog


def st_describe_endpoint(name: str) -> dict:
    """
    Returns metadata about a ServiceTitan endpoint defined in the catalog.
    """

    catalog = load_catalog()

    if name not in catalog:
        raise ValueError(f"Endpoint '{name}' not found in catalog")

    endpoint = catalog[name]

    return {
        "name": endpoint.name,
        "path": endpoint.path,
        "items_key": endpoint.items_key,
        "allowed_params": sorted(endpoint.allowed_params),
        "default_page_size": endpoint.default_page_size,
        "pii_fields": sorted(endpoint.pii_fields),
        "description": endpoint.description,
    }