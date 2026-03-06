from __future__ import annotations

from typing import Any

from app.mcp.servicetitan_analytics.config import get_mcp_st_settings
from app.mcp.servicetitan_analytics.st_client import get_mcp_st_client


def _safe_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def jobs_funnel(start_date: str, end_date: str, business_unit_id: int | None = None) -> dict:
    settings = get_mcp_st_settings()
    client = get_mcp_st_client()

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

    cohort_job_ids: set[int] = set()
    completed_job_ids: set[int] = set()
    cancelled_job_ids: set[int] = set()

    for job in jobs:
        job_id = job.get("id")
        if job_id is None:
            continue

        cohort_job_ids.add(job_id)

        status_candidates = [
            str(job.get("status") or ""),
            str(job.get("jobStatus") or ""),
            str(job.get("statusName") or ""),
        ]
        combined_status = " ".join(status_candidates).lower()

        if "cancel" in combined_status:
            cancelled_job_ids.add(job_id)

        completed_on = job.get("completedOn") or job.get("completedAt")
        if completed_on:
            completed_job_ids.add(job_id)

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

    invoiced_job_ids: set[int] = set()
    completed_invoiced_job_ids: set[int] = set()
    invoiced_invoice_ids: set[int] = set()
    zero_dollar_invoice_count = 0
    non_zero_invoice_count = 0

    for inv in invoices:
        job = inv.get("job") if isinstance(inv.get("job"), dict) else None
        job_id = job.get("id") if job else None
        inv_id = inv.get("id")

        if job_id in cohort_job_ids:
            invoiced_job_ids.add(job_id)
            if inv_id is not None:
                invoiced_invoice_ids.add(inv_id)

            if job_id in completed_job_ids:
                completed_invoiced_job_ids.add(job_id)

            total = _safe_float(inv.get("total"))
            if total > 0:
                non_zero_invoice_count += 1
            else:
                zero_dollar_invoice_count += 1

    payments_params: dict[str, Any] = {
        "createdOnOrAfter": start_date,
        "createdBefore": end_date,
    }

    payments_resp = client.get_paginated(
        path=f"/accounting/v2/tenant/{settings.tenant_id}/payments",
        params=payments_params,
        items_key="data",
        max_rows=settings.max_rows,
    )
    payments = payments_resp.get("data", [])

    if business_unit_id is not None:
        payments = [
            p for p in payments
            if isinstance(p.get("businessUnit"), dict)
            and p["businessUnit"].get("id") == business_unit_id
        ]

    paid_invoice_refs: set[int] = set()
    successful_payment_count = 0
    total_collected = 0.0

    for payment in payments:
        total = _safe_float(payment.get("total"))
        if total > 0:
            successful_payment_count += 1
            total_collected += total

        applied_to = payment.get("appliedTo")
        if isinstance(applied_to, list):
            for item in applied_to:
                if isinstance(item, dict):
                    ref = item.get("appliedTo")
                    if ref is not None:
                        paid_invoice_refs.add(ref)

    completed_paid_job_ids: set[int] = set()
    for inv in invoices:
        inv_id = inv.get("id")
        job = inv.get("job") if isinstance(inv.get("job"), dict) else None
        job_id = job.get("id") if job else None

        if (
            job_id in completed_invoiced_job_ids
            and inv_id in paid_invoice_refs
        ):
            completed_paid_job_ids.add(job_id)

    jobs_created_count = len(cohort_job_ids)
    jobs_completed_count = len(completed_job_ids & cohort_job_ids)
    jobs_cancelled_count = len(cancelled_job_ids & cohort_job_ids)
    jobs_with_invoices_count = len(completed_invoiced_job_ids)
    jobs_with_paid_invoices_count = len(completed_paid_job_ids)

    return {
        "filters": {
            "startDate": start_date,
            "endDate": end_date,
            "businessUnitId": business_unit_id,
        },
        "summary": {
            "jobs_created": jobs_created_count,
            "jobs_completed": jobs_completed_count,
            "jobs_cancelled": jobs_cancelled_count,
            "jobs_with_any_invoices": len(invoiced_job_ids),
            "jobs_with_invoices": jobs_with_invoices_count,
            "jobs_with_paid_invoices": jobs_with_paid_invoices_count,
            "cohort_invoice_count": len(invoiced_invoice_ids),
            "non_zero_invoices": non_zero_invoice_count,
            "zero_dollar_invoices": zero_dollar_invoice_count,
            "successful_payments": successful_payment_count,
            "total_collected": round(total_collected, 2),
        },
        "funnel": [
            {"stage": "jobs_created", "count": jobs_created_count},
            {"stage": "jobs_completed", "count": jobs_completed_count},
            {"stage": "completed_jobs_with_invoices", "count": jobs_with_invoices_count},
            {"stage": "completed_jobs_with_paid_invoices", "count": jobs_with_paid_invoices_count},
        ],
        "drop_offs": {
            "created_to_completed": jobs_created_count - jobs_completed_count,
            "completed_to_invoiced": jobs_completed_count - jobs_with_invoices_count,
            "invoiced_to_paid": jobs_with_invoices_count - jobs_with_paid_invoices_count,
        },
        "provenance": {
            "job_rows": jobs_resp.get("meta", {}).get("rows_returned", 0),
            "invoice_rows": len(invoices),
            "payment_rows": len(payments),
            "job_pages": jobs_resp.get("meta", {}).get("pages_fetched", 0),
            "invoice_pages": invoices_resp.get("meta", {}).get("pages_fetched", 0),
            "payment_pages": payments_resp.get("meta", {}).get("pages_fetched", 0),
        },
    }