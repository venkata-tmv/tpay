from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.clients.servicetitan_client import ServiceTitanClient
from app.core.config import settings
from app.services.servicetitan_mapping import parse_decimal


@dataclass
class STInvoiceCore:
    invoice_id: int
    job_id: int
    customer_id: int
    total: Decimal
    balance: Decimal
    paid_on: str | None


def get_invoice_core(invoice_id: int, tenant: str | None = None) -> STInvoiceCore:
    tenant = tenant or settings.ST_TENANT_ID
    client = ServiceTitanClient()
    resp = client.get_invoices(tenant=tenant, params={"ids": str(invoice_id), "page": 1, "pageSize": 1})

    data = resp.get("data") or []
    if not data:
        raise ValueError(f"Invoice {invoice_id} not found in ServiceTitan")

    inv: dict[str, Any] = data[0]

    job = inv.get("job") or {}
    cust = inv.get("customer") or {}

    total = parse_decimal(inv.get("total"))
    balance = parse_decimal(inv.get("balance"))

    return STInvoiceCore(
        invoice_id=int(inv["id"]),
        job_id=int(job.get("id") or 0),
        customer_id=int(cust.get("id") or 0),
        total=total,
        balance=balance,
        paid_on=inv.get("paidOn"),
    )

def get_job_detail(job_id: int, externalDataApplicationGuid: str | None = None) -> dict[str, Any]:
    client = ServiceTitanClient()
    return client.get_job_by_id(
        tenant=settings.ST_TENANT_ID,
        job_id=job_id,
        externalDataApplicationGuid=externalDataApplicationGuid,
    )

def list_employees(params: dict[str, Any]) -> dict[str, Any]:
    client = ServiceTitanClient()
    return client.get_employees(tenant=settings.ST_TENANT_ID, params=params)

def list_technicians(params: dict[str, Any]) -> dict[str, Any]:
    client = ServiceTitanClient()
    return client.get_technicians(tenant=settings.ST_TENANT_ID, params=params)