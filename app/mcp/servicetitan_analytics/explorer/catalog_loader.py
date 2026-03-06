from __future__ import annotations

from pathlib import Path
import yaml

from app.mcp.servicetitan_analytics.explorer.models import EndpointDefinition


def load_catalog() -> dict[str, EndpointDefinition]:
    catalog_path = Path(__file__).resolve().parent / "catalog.yaml"

    with open(catalog_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    catalog: dict[str, EndpointDefinition] = {}

    for name, cfg in raw.items():
        catalog[name] = EndpointDefinition(
            name=name,
            path=cfg["path"],
            items_key=cfg.get("items_key", "data"),
            allowed_params=set(cfg.get("allowed_params", [])),
            pii_fields=set(cfg.get("pii_fields", [])),
            default_page_size=cfg.get("default_page_size", 200),
            description=cfg.get("description", ""),
        )

    return catalog