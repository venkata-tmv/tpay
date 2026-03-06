from __future__ import annotations

from collections import defaultdict
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


def _job_type_bucket(job: dict[str, Any]) -> str:
    job_info = job.get("job") if isinstance(job.get("job"), dict) else None

    candidates = [
        str(job.get("jobType") or ""),
        str(job.get("jobTypeName") or ""),
        str(job.get("businessUnitName") or ""),
        str(job.get("summary") or ""),
        str(job.get("type") or ""),
        str(job_info.get("type") if job_info else ""),
    ]
    combined = " ".join(candidates).lower()

    install_keywords = {"install", "replacement", "replace", "system sale", "system install"}
    if any(word in combined for word in install_keywords):
        return "install"

    return "service"


def _top_n_metric_with_names(
    metric_map: dict[Any, float],
    name_map: dict[Any, str],
    n: int = 5,
    reverse: bool = True,
) -> list[dict[str, Any]]:
    sorted_items = sorted(metric_map.items(), key=lambda x: x[1], reverse=reverse)[:n]
    return [
        {
            "employee_id": key,
            "employee_name": name_map.get(key),
            "value": round(value, 2),
        }
        for key, value in sorted_items
    ]


def kpi_daily_summary(date: str, business_unit_id: int | None = None) -> dict:
    settings = get_mcp_st_settings()
    client = get_mcp_st_client()

    start_date, end_date = _day_window(date)

    jobs_params: dict[str, Any] = {
        "completedOnOrAfter": start_date,
        "completedBefore": end_date,
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

    jobs_completed = len(jobs)
    invoices_created = len(invoices)

    total_revenue = 0.0
    non_zero_invoice_revenue = 0.0
    non_zero_invoice_count = 0
    zero_dollar_invoices = 0
    high_discount_invoices = 0
    pending_review_invoices = 0

    revenue_by_employee: dict[Any, float] = defaultdict(float)
    employee_name_by_id: dict[Any, str] = {}
    jobs_by_employee: dict[Any, int] = defaultdict(int)

    install_count = 0
    service_count = 0

    for job in jobs:
        bucket = _job_type_bucket(job)
        if bucket == "install":
            install_count += 1
        else:
            service_count += 1

        employee = job.get("employeeInfo") if isinstance(job.get("employeeInfo"), dict) else None
        if employee:
            emp_id = employee.get("id")
            if emp_id is not None:
                jobs_by_employee[emp_id] += 1
                employee_name_by_id[emp_id] = employee.get("name") or str(emp_id)

    for inv in invoices:
        total = _safe_float(inv.get("total"))
        discount = _safe_float(inv.get("discountTotal"))
        subtotal = _safe_float(inv.get("subTotal"))

        total_revenue += total

        if total == 0:
            zero_dollar_invoices += 1
        else:
            non_zero_invoice_count += 1
            non_zero_invoice_revenue += total

        if subtotal > 0 and discount / subtotal >= 0.3:
            high_discount_invoices += 1

        if inv.get("reviewStatus") == "NeedsReview" or inv.get("syncStatus") == "Pending":
            pending_review_invoices += 1

        employee = inv.get("employeeInfo") if isinstance(inv.get("employeeInfo"), dict) else None
        if employee:
            emp_id = employee.get("id")
            if emp_id is not None:
                revenue_by_employee[emp_id] += total
                employee_name_by_id[emp_id] = employee.get("name") or str(emp_id)

    average_ticket_all = total_revenue / invoices_created if invoices_created else 0.0
    average_ticket_non_zero = (
        non_zero_invoice_revenue / non_zero_invoice_count if non_zero_invoice_count else 0.0
    )

    install_mix_pct = (install_count / jobs_completed) if jobs_completed else 0.0
    service_mix_pct = (service_count / jobs_completed) if jobs_completed else 0.0

    return {
        "date": date,
        "filters": {
            "businessUnitId": business_unit_id,
        },
        "summary": {
            "jobs_completed": jobs_completed,
            "invoices_created": invoices_created,
            "revenue_invoiced_total": round(total_revenue, 2),
            "revenue_invoiced_non_zero_only": round(non_zero_invoice_revenue, 2),
            "non_zero_invoice_count": non_zero_invoice_count,
            "average_ticket_all_invoices": round(average_ticket_all, 2),
            "average_ticket_non_zero_only": round(average_ticket_non_zero, 2),
            "install_jobs": install_count,
            "service_jobs": service_count,
            "install_mix_pct": round(install_mix_pct, 4),
            "service_mix_pct": round(service_mix_pct, 4),
        },
        "scorecards": {
            "top_by_revenue": _top_n_metric_with_names(
                revenue_by_employee, employee_name_by_id, n=5, reverse=True
            ),
            "bottom_by_revenue": _top_n_metric_with_names(
                revenue_by_employee, employee_name_by_id, n=5, reverse=False
            ),
            "jobs_by_employee": [
                {
                    "employee_id": emp_id,
                    "employee_name": employee_name_by_id.get(emp_id),
                    "jobs_completed": count,
                }
                for emp_id, count in sorted(
                    jobs_by_employee.items(),
                    key=lambda x: x[1],
                    reverse=True,
                )[:10]
            ],
        },
        "exceptions": {
            "zero_dollar_invoices": zero_dollar_invoices,
            "high_discount_invoices": high_discount_invoices,
            "pending_or_needs_review_invoices": pending_review_invoices,
        },
        "provenance": {
            "jobs_rows": jobs_resp.get("meta", {}).get("rows_returned", 0),
            "invoice_rows": len(invoices),
            "jobs_pages": jobs_resp.get("meta", {}).get("pages_fetched", 0),
            "invoice_pages": invoices_resp.get("meta", {}).get("pages_fetched", 0),
        },
    }