from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from app.mcp.servicetitan_analytics.explorer.describe_endpoint import (
    st_describe_endpoint,
)
from app.mcp.servicetitan_analytics.explorer.get import st_get
from app.mcp.servicetitan_analytics.explorer.list_api_groups import (
    st_list_api_groups,
)
from app.mcp.servicetitan_analytics.tools.cash_collections import (
    cash_collections,
)
from app.mcp.servicetitan_analytics.tools.exceptions_report import (
    exceptions_report,
)
from app.mcp.servicetitan_analytics.tools.jobs_funnel import jobs_funnel
from app.mcp.servicetitan_analytics.tools.kpi_daily_summary import (
    kpi_daily_summary,
)
from app.mcp.servicetitan_analytics.tools.business_health_snapshot import (
    business_health_snapshot,
)
mcp = FastMCP("servicetitan-analytics")


@mcp.tool(
    name="list_api_groups",
    description="List the ServiceTitan data groups available through the read-only explorer catalog."
)
def list_api_groups_tool() -> dict:
    return st_list_api_groups()


@mcp.tool(
    name="describe_endpoint",
    description="Describe a configured explorer endpoint, including its path, allowed parameters, and response metadata."
)
def describe_endpoint_tool(name: str) -> dict:
    return st_describe_endpoint(name)


@mcp.tool(
    name="st_get_endpoint",
    description="Run a read-only explorer query against a configured ServiceTitan endpoint with guarded parameters, pagination, and redaction."
)
def st_get_endpoint_tool(endpoint: str, params: dict | None = None) -> dict:
    return st_get(endpoint=endpoint, params=params)


@mcp.tool(
    name="kpi_daily",
    description="Return a daily operations KPI snapshot, including completed jobs, invoice activity, average ticket, install/service mix, and technician scorecards."
)
def kpi_daily_tool(date: str, business_unit_id: int | None = None) -> dict:
    return kpi_daily_summary(date=date, business_unit_id=business_unit_id)


@mcp.tool(
    name="daily_exceptions",
    description="Return a daily operational exceptions report, including zero-dollar invoices, pending or review-state invoices, high discounts, and cancelled jobs."
)
def daily_exceptions_tool(date: str, business_unit_id: int | None = None) -> dict:
    return exceptions_report(date=date, business_unit_id=business_unit_id)


@mcp.tool(
    name="cash_collections_summary",
    description="Return a cash collections summary for a date range using payment activity, including totals collected, successful payments, failures, warnings, and breakdowns."
)
def cash_collections_summary_tool(
    start_date: str,
    end_date: str,
    business_unit_id: int | None = None,
) -> dict:
    return cash_collections(
        start_date=start_date,
        end_date=end_date,
        business_unit_id=business_unit_id,
    )


@mcp.tool(
    name="jobs_funnel_summary",
    description="Return a cohort-based jobs funnel for a date range, tracking jobs created, completed, invoiced, and paid."
)
def jobs_funnel_summary_tool(
    start_date: str,
    end_date: str,
    business_unit_id: int | None = None,
) -> dict:
    return jobs_funnel(
        start_date=start_date,
        end_date=end_date,
        business_unit_id=business_unit_id,
    )

@mcp.tool(
    name="business_health_snapshot",
    description="Return a consolidated daily business snapshot combining KPI summary, cash collections, operational exceptions, and jobs funnel metrics."
)
def business_health_snapshot_tool(
    date: str,
    business_unit_id: int | None = None,
) -> dict:
    return business_health_snapshot(
        date=date,
        business_unit_id=business_unit_id,
    )

if __name__ == "__main__":
    mcp.run()