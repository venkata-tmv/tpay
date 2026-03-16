from __future__ import annotations
from typing import Any
from fastapi import APIRouter, HTTPException, Query, Body
from app.clients.servicetitan_client import (
    ServiceTitanClient,
    ServiceTitanAuthError,
    ServiceTitanAPIError,
)
from app.services.servicetitan_writeback_service import write_tpay_reference_to_invoice
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

@router.get("/customers")
def list_customers(
    tenant: str = Query(default=settings.ST_TENANT_ID),
    page: int | None = Query(default=1, ge=1),
    pageSize: int | None = Query(default=50, ge=1, le=500),
    includeTotal: bool | None = Query(default=True),
    ids: str | None = Query(default=None, description="Comma-separated customer ids"),
    name: str | None = Query(default=None),
    phone: str | None = Query(default=None),
    city: str | None = Query(default=None),
    state: str | None = Query(default=None),
    zip: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    sort: str | None = Query(default=None),
) -> dict[str, Any]:
    """
    Proxy to ServiceTitan:
    GET /crm/v2/tenant/{tenant}/customers
    """
    params: dict[str, Any] = {}

    for k, v in {
        "page": page,
        "pageSize": pageSize,
        "includeTotal": includeTotal,
        "ids": ids,
        "name": name,
        "phone": phone,
        "city": city,
        "state": state,
        "zip": zip,
        "active": active,
        "sort": sort,
    }.items():
        if v is not None:
            params[k] = v

    client = ServiceTitanClient()
    try:
        return client.get_customers(tenant=tenant, params=params)
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    

@router.get("/customers/{customer_id}")
def get_customer_by_id(
    customer_id: int,
    tenant: str = Query(default=settings.ST_TENANT_ID),
) -> dict[str, Any]:
    """
    Fetch a single customer via list endpoint: ids=<customer_id>
    """
    client = ServiceTitanClient()
    try:
        return client.get_customers(
            tenant=tenant,
            params={"ids": str(customer_id), "page": 1, "pageSize": 1},
        )
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    
@router.post("/invoices/{invoice_id}/tpay-reference")
def set_invoice_tpay_reference(
    invoice_id: int,
    payload: dict[str, str] = Body(..., example={
        "TPAY_PAYMENT_ID": "uuid-here",
        "TPAY_STATUS": "succeeded",
        "TILLED_PROVIDER_PAYMENT_ID": "pi_xxx",
    }),
    tenant: str = Query(default=settings.ST_TENANT_ID),
):
    """
    Writes TPay-related refs back to ServiceTitan invoice custom fields.
    """
    try:
        return write_tpay_reference_to_invoice(
            invoice_id=invoice_id,
            custom_fields=payload,
            tenant=tenant,
        )
    except Exception as exc:
        # You can wrap specific exceptions, but keep simple for MVP
        raise HTTPException(status_code=502, detail=str(exc))
    
@router.get("/jobs/{job_id}")
def get_job_detail_api(
    job_id: int,
    externalDataApplicationGuid: str | None = Query(default=None),
):
    client = ServiceTitanClient()
    try:
        return client.get_job_by_id(
            tenant=settings.ST_TENANT_ID,
            job_id=job_id,
            externalDataApplicationGuid=externalDataApplicationGuid,
        )
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    
@router.get("/employees")
def get_employees_api(
    ids: str | None = None,
    userIds: str | None = None,
    name: str | None = None,
    email: str | None = None,
    active: bool | None = None,
    page: int = 1,
    pageSize: int = 50,
    includeTotal: bool | None = True,
    createdBefore: str | None = None,
    createdOnOrAfter: str | None = None,
    modifiedBefore: str | None = None,
    modifiedOnOrAfter: str | None = None,
):
    params = {k: v for k, v in {
        "ids": ids,
        "userIds": userIds,
        "name": name,
        "email": email,
        "active": active,
        "page": page,
        "pageSize": pageSize,
        "includeTotal": includeTotal,
        "createdBefore": createdBefore,
        "createdOnOrAfter": createdOnOrAfter,
        "modifiedBefore": modifiedBefore,
        "modifiedOnOrAfter": modifiedOnOrAfter,
    }.items() if v is not None}

    client = ServiceTitanClient()
    try:
        return client.get_employees(tenant=settings.ST_TENANT_ID, params=params)
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    
@router.get("/technicians")
def get_technicians_api(
    ids: str | None = None,
    userIds: str | None = None,
    name: str | None = None,
    active: bool | None = None,
    page: int = 1,
    pageSize: int = 50,
    includeTotal: bool | None = True,
    createdBefore: str | None = None,
    createdOnOrAfter: str | None = None,
    modifiedBefore: str | None = None,
    modifiedOnOrAfter: str | None = None,
):
    params = {k: v for k, v in {
        "ids": ids,
        "userIds": userIds,
        "name": name,
        "active": active,
        "page": page,
        "pageSize": pageSize,
        "includeTotal": includeTotal,
        "createdBefore": createdBefore,
        "createdOnOrAfter": createdOnOrAfter,
        "modifiedBefore": modifiedBefore,
        "modifiedOnOrAfter": modifiedOnOrAfter,
    }.items() if v is not None}

    client = ServiceTitanClient()
    try:
        return client.get_technicians(tenant=settings.ST_TENANT_ID, params=params)
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    
@router.get("/locations/{location_id}")
def get_location_by_id(
    location_id: int,
    tenant: str = Query(default=settings.ST_TENANT_ID),
):
    client = ServiceTitanClient()
    try:
        return client.get_locations(
            tenant=tenant,
            params={"ids": str(location_id), "page": 1, "pageSize": 1, "includeTotal": True},
        )
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/business-units/{business_unit_id}")
def get_business_unit_by_id(
    business_unit_id: int,
    tenant: str = Query(default=settings.ST_TENANT_ID),
):
    def _extract_records(payload: dict) -> list[dict]:
        if not isinstance(payload, dict):
            return []
        for key in ("data", "items", "results", "records", "businessUnits"):
            value = payload.get(key)
            if isinstance(value, list):
                return [v for v in value if isinstance(v, dict)]
        return [payload]

    def _match_id(records: list[dict]) -> dict | None:
        wanted = str(business_unit_id)
        for record in records:
            rid = record.get("id")
            if rid is not None and str(rid) == wanted:
                return record
        return None

    client = ServiceTitanClient()
    try:
        # Preferred call when ids filtering is supported by the connected tenant/version.
        return client.get_business_units(
            tenant=tenant,
            params={"ids": str(business_unit_id), "page": 1, "pageSize": 1, "includeTotal": True},
        )
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        # Fallback: some ServiceTitan setups reject ids filtering for business units.
        try:
            page = 1
            page_size = 200
            max_pages = 20
            while page <= max_pages:
                listing = client.get_business_units(
                    tenant=tenant,
                    params={"page": page, "pageSize": page_size, "includeTotal": True},
                )
                records = _extract_records(listing)
                matched = _match_id(records)
                if matched:
                    return matched
                # Stop early when we hit the end of returned records.
                if len(records) < page_size:
                    break
                page += 1
        except ServiceTitanAPIError:
            pass
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/payment-types")
def get_payement_types(
    tenant: str = Query(default=settings.ST_TENANT_ID),
):
    client = ServiceTitanClient()
    try:
        return client.list_payment_types(tenant=tenant)
    except ServiceTitanAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ServiceTitanAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
