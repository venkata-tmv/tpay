from __future__ import annotations
from typing import Any
from fastapi import APIRouter, HTTPException, Query
from app.clients.servicetitan_client import (
    ServiceTitanClient,
    ServiceTitanAuthError,
    ServiceTitanAPIError,
)
from app.core.config import settings

router = APIRouter()


@router.get("/jobs")
def list_jobs(
    tenant: str = Query(default=settings.ST_TENANT_ID),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=500),
    includeTotal: bool | None = Query(default=None),
    ids: str | None = Query(default=None, description="Comma-separated ids"),
    number: str | None = Query(default=None),
    technicianId: str | None = Query(default=None),
    customerId: str | None = Query(default=None),
    locationId: str | None = Query(default=None),
    invoiceId: str | None = Query(default=None),
    jobStatus: str | None = Query(default=None),
    appointmentStatus: str | None = Query(default=None),
    sort: str | None = Query(default=None),
) -> dict[str, Any]:
    """
    Proxy to ServiceTitan Integration API:
    GET https://api-integration.servicetitan.io/jpm/v2/tenant/{tenant}/jobs

    We keep it flexible and pass through selected query params.
    """
    params: dict[str, Any] = {}

    # Only include provided params (avoid sending None)
    for k, v in {
        "page": page,
        "pageSize": pageSize,
        "includeTotal": includeTotal,
        "ids": ids,
        "number": number,
        "technicianId": technicianId,
        "customerId": customerId,
        "locationId": locationId,
        "invoiceId": invoiceId,
        "jobStatus": jobStatus,
        "appointmentStatus": appointmentStatus,
        "sort": sort,
    }.items():
        if v is not None:
            params[k] = v

    client = ServiceTitanClient()

    try:
        return client.get_jobs(tenant=tenant, params=params)
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    
@router.get("/invoices")
def list_invoices(
    tenant: str = Query(default=settings.ST_TENANT_ID),
    ids: str | None = Query(default=None, description="Comma-separated invoice ids"),
    jobId: int | None = Query(default=None),
    customerId: int | None = Query(default=None),
    page: int | None = Query(default=1, ge=1),
    pageSize: int | None = Query(default=50, ge=1, le=500),
    includeTotal: bool | None = Query(default=True),
) -> dict[str, Any]:
    """
    Proxy to ServiceTitan:
    GET /accounting/v2/tenant/{tenant}/invoices
    """
    params: dict[str, Any] = {}

    for k, v in {
        "ids": ids,
        "jobId": jobId,
        "customerId": customerId,
        "page": page,
        "pageSize": pageSize,
        "includeTotal": includeTotal,
    }.items():
        if v is not None:
            params[k] = v

    client = ServiceTitanClient()
    try:
        return client.get_invoices(tenant=tenant, params=params)
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    
@router.get("/invoices/{invoice_id}")
def get_invoice_by_id(
    invoice_id: int,
    tenant: str = Query(default=settings.ST_TENANT_ID),
) -> dict[str, Any]:
    """
    Fetch a single invoice by calling list endpoint with ids=<invoice_id>.
    """
    client = ServiceTitanClient()
    try:
        result = client.get_invoices(tenant=tenant, params={"ids": str(invoice_id), "page": 1, "pageSize": 1})
        return result
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))