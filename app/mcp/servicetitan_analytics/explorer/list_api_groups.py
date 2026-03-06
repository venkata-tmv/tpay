from __future__ import annotations

from app.mcp.servicetitan_analytics.explorer.catalog_loader import load_catalog


def st_list_api_groups() -> dict:
    """
    Returns the list of available ServiceTitan endpoint groups
    configured in the MCP catalog.
    """

    catalog = load_catalog()

    groups = sorted(catalog.keys())

    return {
        "groups": groups,
        "count": len(groups),
    }