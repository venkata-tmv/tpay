from __future__ import annotations

from typing import Any

from app.clients.servicetitan_client import ServiceTitanClient
from app.core.config import settings


def write_tpay_reference_to_invoice(
    *,
    invoice_id: int,
    custom_fields: dict[str, str],
    tenant: str | None = None,
) -> dict[str, Any]:
    """
    Writes TPay/Tilled references back to ServiceTitan invoice using custom fields.
    """
    tenant = tenant or settings.ST_TENANT_ID

    ops = [{
        "objectId": invoice_id,
        "customFields": [{"name": k, "value": v} for k, v in custom_fields.items()],
    }]

    client = ServiceTitanClient()
    return client.patch_invoice_custom_fields(tenant=tenant, operations=ops)