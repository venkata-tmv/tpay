from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app.mcp.servicetitan_analytics.config import get_mcp_st_settings
from app.mcp.servicetitan_analytics.st_client import get_mcp_st_client


def _day_window(date_str: str) -> tuple[str, str]:
    day = datetime.strptime(date_str, "%Y-%m-%d")
    next_day = day + timedelta(days=1)
    return day.strftime("%Y-%m-%d"), next_day.strftime("%Y-%m-%d")


def _safe_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def exceptions_report(date: str, business_unit_id: int | None = None) -> dict:
    """
    Operational exceptions snapshot for a given day.

    Focuses on manager-visible anomalies:
    - zero-dollar invoices
    - invoices pending sync / review
    - high discounts
    - cancelled jobs
    """

    settings = get_mcp_st_settings()
    client = get_mcp_st_client()

    start_date, end_date = _day_window(date)

    jobs_params: dict[str, Any] = {
        "createdOnOrAfter": start_date,
        "createdBefore": end_date,
    }
    if business_unit_id is not None:
        jobs_params["businessUnitId"] = business_unit_id

    jobs_resp = client.get_paginated(
        path=f"/jpm/v2/tenant/{settings.tenant_id}/jobs",
        params=jobs_params,
        items_key="data",
        max_rows=settings.max_rows,
    )
    jobs = jobs_resp.get("data", [])

    invoices_params: dict[str, Any] = {
        "createdOnOrAfter": start_date,
        "createdBefore": end_date,
    }

    invoices_resp = client.get_paginated(
        path=f"/accounting/v2/tenant/{settings.tenant_id}/invoices",
        params=invoices_params,
        items_key="data",
        max_rows=settings.max_rows,
    )
    invoices = invoices_resp.get("data", [])

    if business_unit_id is not None:
        invoices = [
            inv for inv in invoices
            if isinstance(inv.get("businessUnit"), dict)
            and inv["businessUnit"].get("id") == business_unit_id
        ]

    zero_dollar_invoices: list[dict[str, Any]] = []
    pending_or_review_invoices: list[dict[str, Any]] = []
    high_discount_invoices: list[dict[str, Any]] = []
    cancelled_jobs: list[dict[str, Any]] = []

    for inv in invoices:
        total = _safe_float(inv.get("total"))
        subtotal = _safe_float(inv.get("subTotal"))
        discount = _safe_float(inv.get("discountTotal"))

        record = {
            "invoice_id": inv.get("id"),
            "reference_number": inv.get("referenceNumber"),
            "created_on": inv.get("createdOn"),
            "invoice_date": inv.get("invoiceDate"),
            "total": total,
            "sub_total": subtotal,
            "discount_total": discount,
            "sync_status": inv.get("syncStatus"),
            "review_status": inv.get("reviewStatus"),
            "invoice_configuration": inv.get("invoiceConfiguration"),
            "business_unit": inv.get("businessUnit", {}).get("name")
            if isinstance(inv.get("businessUnit"), dict)
            else None,
            "job_id": inv.get("job", {}).get("id")
            if isinstance(inv.get("job"), dict)
            else None,
            "job_type": inv.get("job", {}).get("type")
            if isinstance(inv.get("job"), dict)
            else None,
            "employee_name": inv.get("employeeInfo", {}).get("name")
            if isinstance(inv.get("employeeInfo"), dict)
            else None,
        }

        if total == 0:
            zero_dollar_invoices.append(record)

        if inv.get("syncStatus") == "Pending" or inv.get("reviewStatus") == "NeedsReview":
            pending_or_review_invoices.append(record)

        if subtotal > 0 and discount / subtotal >= 0.3:
            high_discount_invoices.append(record)

    for job in jobs:
        status_candidates = [
            str(job.get("status") or ""),
            str(job.get("jobStatus") or ""),
            str(job.get("statusName") or ""),
        ]
        combined_status = " ".join(status_candidates).lower()

        if "cancel" in combined_status:
            cancelled_jobs.append(
                {
                    "job_id": job.get("id"),
                    "job_number": job.get("number"),
                    "created_on": job.get("createdOn"),
                    "completed_on": job.get("completedOn"),
                    "status": job.get("status") or job.get("jobStatus") or job.get("statusName"),
                    "business_unit": job.get("businessUnit", {}).get("name")
                    if isinstance(job.get("businessUnit"), dict)
                    else None,
                    "technician": job.get("technician", {}).get("name")
                    if isinstance(job.get("technician"), dict)
                    else None,
                }
            )

    return {
        "date": date,
        "filters": {
            "businessUnitId": business_unit_id,
        },
        "summary": {
            "zero_dollar_invoice_count": len(zero_dollar_invoices),
            "pending_or_review_invoice_count": len(pending_or_review_invoices),
            "high_discount_invoice_count": len(high_discount_invoices),
            "cancelled_job_count": len(cancelled_jobs),
        },
        "details": {
            "zero_dollar_invoices": zero_dollar_invoices[:25],
            "pending_or_review_invoices": pending_or_review_invoices[:25],
            "high_discount_invoices": high_discount_invoices[:25],
            "cancelled_jobs": cancelled_jobs[:25],
        },
        "provenance": {
            "jobs_rows": jobs_resp.get("meta", {}).get("rows_returned", 0),
            "invoice_rows": len(invoices),
            "jobs_pages": jobs_resp.get("meta", {}).get("pages_fetched", 0),
            "invoice_pages": invoices_resp.get("meta", {}).get("pages_fetched", 0),
        },
    }