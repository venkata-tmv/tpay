from __future__ import annotations

import os
import sys
import logging
from typing import Any, Optional

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Force-load .env regardless of working directory
load_dotenv(dotenv_path="/Users/likith/Documents/tpay/.env", override=False)

# Log to stderr (stdio MCP uses stdout for protocol)
handler = logging.StreamHandler(sys.stderr)
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger(__name__)

mcp = FastMCP("tpay-servicetitan-readonly")

# Import your existing client AFTER env is loaded
from app.clients.servicetitan_client import ServiceTitanClient  # noqa: E402

st = ServiceTitanClient()

def _tenant(tenant: Optional[str]) -> str:
    return tenant or os.environ["ST_TENANT_ID"]


@mcp.tool()
def ping() -> str:
    """Health check tool for MCP discovery."""
    return "pong"
    
@mcp.tool()
def st_get_job_by_id(job_id: int, tenant: Optional[str] = None, externalDataApplicationGuid: Optional[str] = None) -> dict[str, Any]:
    """Get a single job by ID from ServiceTitan (read-only)."""
    try:
        return st.get_job_by_id(
            tenant=_tenant(tenant),
            job_id=job_id,
            externalDataApplicationGuid=externalDataApplicationGuid,
        )
    except (ServiceTitanAuthError, ServiceTitanAPIError) as e:
        return {"ok": False, "error": str(e)}


@mcp.tool()
def st_get_jobs(
    tenant: Optional[str] = None,
    page: int = 1,
    pageSize: int = 50,
    includeTotal: bool = True,
    ids: Optional[str] = None,
    number: Optional[str] = None,
    customerId: Optional[int] = None,
    locationId: Optional[int] = None,
    jobStatus: Optional[str] = None,
    appointmentStatus: Optional[str] = None,
) -> dict[str, Any]:
    """Search jobs (read-only). Mirrors GET /jpm/v2/tenant/{tenant}/jobs."""
    params: dict[str, Any] = {
        "page": page,
        "pageSize": pageSize,
        "includeTotal": includeTotal,
    }
    if ids: params["ids"] = ids
    if number: params["number"] = number
    if customerId is not None: params["customerId"] = customerId
    if locationId is not None: params["locationId"] = locationId
    if jobStatus: params["jobStatus"] = jobStatus
    if appointmentStatus: params["appointmentStatus"] = appointmentStatus

    try:
        return st.get_jobs(tenant=_tenant(tenant), params=params)
    except (ServiceTitanAuthError, ServiceTitanAPIError) as e:
        return {"ok": False, "error": str(e), "params": params}


@mcp.tool()
def st_get_invoices(
    tenant: Optional[str] = None,
    page: int = 1,
    pageSize: int = 50,
    includeTotal: bool = True,
    ids: Optional[str] = None,
    jobId: Optional[int] = None,
    customerId: Optional[int] = None,
    statuses: Optional[str] = None,
) -> dict[str, Any]:
    """Search invoices (read-only). Mirrors GET /accounting/v2/tenant/{tenant}/invoices."""
    params: dict[str, Any] = {
        "page": page,
        "pageSize": pageSize,
        "includeTotal": includeTotal,
    }
    if ids: params["ids"] = ids
    if jobId is not None: params["jobId"] = jobId
    if customerId is not None: params["customerId"] = customerId
    if statuses: params["statuses"] = statuses

    try:
        return st.get_invoices(tenant=_tenant(tenant), params=params)
    except (ServiceTitanAuthError, ServiceTitanAPIError) as e:
        return {"ok": False, "error": str(e), "params": params}


@mcp.tool()
def st_get_customers(
    tenant: Optional[str] = None,
    page: int = 1,
    pageSize: int = 50,
    includeTotal: bool = True,
    ids: Optional[str] = None,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    active: Optional[bool] = None,
) -> dict[str, Any]:
    """Search customers (read-only). Mirrors GET /crm/v2/tenant/{tenant}/customers."""
    params: dict[str, Any] = {
        "page": page,
        "pageSize": pageSize,
        "includeTotal": includeTotal,
    }
    if ids: params["ids"] = ids
    if name: params["name"] = name
    if phone: params["phone"] = phone
    if city: params["city"] = city
    if state: params["state"] = state
    if active is not None: params["active"] = active

    try:
        return st.get_customers(tenant=_tenant(tenant), params=params)
    except (ServiceTitanAuthError, ServiceTitanAPIError) as e:
        return {"ok": False, "error": str(e), "params": params}


@mcp.tool()
def st_get_employees(
    tenant: Optional[str] = None,
    page: int = 1,
    pageSize: int = 50,
    includeTotal: bool = True,
    ids: Optional[str] = None,
) -> dict[str, Any]:
    """List employees (read-only). Mirrors GET /settings/v2/tenant/{tenant}/employees."""
    params: dict[str, Any] = {"page": page, "pageSize": pageSize, "includeTotal": includeTotal}
    if ids: params["ids"] = ids

    try:
        return st.get_employees(tenant=_tenant(tenant), params=params)
    except (ServiceTitanAuthError, ServiceTitanAPIError) as e:
        return {"ok": False, "error": str(e), "params": params}


@mcp.tool()
def st_get_technicians(
    tenant: Optional[str] = None,
    page: int = 1,
    pageSize: int = 50,
    includeTotal: bool = True,
    ids: Optional[str] = None,
) -> dict[str, Any]:
    """List technicians (read-only). Mirrors GET /settings/v2/tenant/{tenant}/technicians."""
    params: dict[str, Any] = {"page": page, "pageSize": pageSize, "includeTotal": includeTotal}
    if ids: params["ids"] = ids

    try:
        return st.get_technicians(tenant=_tenant(tenant), params=params)
    except (ServiceTitanAuthError, ServiceTitanAPIError) as e:
        return {"ok": False, "error": str(e), "params": params}


if __name__ == "__main__":
    # Runs MCP over stdio (best for local dev)
    mcp.run()