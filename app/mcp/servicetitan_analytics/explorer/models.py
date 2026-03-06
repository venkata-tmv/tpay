from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class EndpointDefinition:
    name: str
    path: str
    items_key: str = "data"
    allowed_params: set[str] = field(default_factory=set)
    pii_fields: set[str] = field(default_factory=set)
    default_page_size: int = 200
    description: str = ""