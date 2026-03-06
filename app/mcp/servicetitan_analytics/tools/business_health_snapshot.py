from __future__ import annotations

from datetime import datetime, timedelta

from app.mcp.servicetitan_analytics.tools.cash_collections import cash_collections
from app.mcp.servicetitan_analytics.tools.exceptions_report import exceptions_report
from app.mcp.servicetitan_analytics.tools.jobs_funnel import jobs_funnel
from app.mcp.servicetitan_analytics.tools.kpi_daily_summary import kpi_daily_summary


def _next_day(date_str: str) -> str:
    day = datetime.strptime(date_str, "%Y-%m-%d")
    return (day + timedelta(days=1)).strftime("%Y-%m-%d")


def business_health_snapshot(date: str, business_unit_id: int | None = None) -> dict:
    kpi = kpi_daily_summary(date=date, business_unit_id=business_unit_id)
    exceptions = exceptions_report(date=date, business_unit_id=business_unit_id)
    cash = cash_collections(
        start_date=date,
        end_date=_next_day(date),
        business_unit_id=business_unit_id,
    )
    funnel = jobs_funnel(
        start_date=date,
        end_date=_next_day(date),
        business_unit_id=business_unit_id,
    )

    return {
        "date": date,
        "filters": {
            "businessUnitId": business_unit_id,
        },
        "headline": {
            "jobs_completed": kpi.get("summary", {}).get("jobs_completed", 0),
            "revenue_invoiced_total": kpi.get("summary", {}).get("revenue_invoiced_total", 0.0),
            "cash_collected": cash.get("summary", {}).get("total_collected", 0.0),
            "successful_payments": cash.get("summary", {}).get("successful_payment_count", 0),
            "zero_dollar_invoices": exceptions.get("summary", {}).get("zero_dollar_invoice_count", 0),
            "pending_or_review_invoices": exceptions.get("summary", {}).get("pending_or_review_invoice_count", 0),
            "cancelled_jobs": exceptions.get("summary", {}).get("cancelled_job_count", 0),
        },
        "summaries": {
            "kpi_daily": kpi.get("summary", {}),
            "cash_collections": cash.get("summary", {}),
            "exceptions": exceptions.get("summary", {}),
            "jobs_funnel": funnel.get("summary", {}),
        },
        "funnel": funnel.get("funnel", []),
        "drop_offs": funnel.get("drop_offs", {}),
    }