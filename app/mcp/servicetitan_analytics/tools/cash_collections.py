from __future__ import annotations

from collections import defaultdict
from datetime import datetime
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


def _top_n(metric_map: dict[Any, float], name_map: dict[Any, str], n: int = 10) -> list[dict[str, Any]]:
    sorted_items = sorted(metric_map.items(), key=lambda x: x[1], reverse=True)[:n]
    return [
        {
            "key": key,
            "name": name_map.get(key),
            "value": round(value, 2),
        }
        for key, value in sorted_items
    ]


def cash_collections(start_date: str, end_date: str, business_unit_id: int | None = None) -> dict:
    """
    Cash collections / payment activity summary for a date range.
    Uses ServiceTitan payments endpoint as the primary money-received signal.
    """

    settings = get_mcp_st_settings()
    client = get_mcp_st_client()

    params: dict[str, Any] = {
        "createdOnOrAfter": start_date,
        "createdBefore": end_date,
    }

    payments_resp = client.get_paginated(
        path=f"/accounting/v2/tenant/{settings.tenant_id}/payments",
        params=params,
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

    total_collected = 0.0
    successful_payment_count = 0
    zero_amount_payment_count = 0
    pending_sync_count = 0
    failed_or_warning_count = 0

    collections_by_type: dict[str, float] = defaultdict(float)
    collections_by_business_unit: dict[Any, float] = defaultdict(float)
    bu_name_by_id: dict[Any, str] = {}

    failed_or_warning_payments: list[dict[str, Any]] = []

    for payment in payments:
        total = _safe_float(payment.get("total"))
        payment_type = payment.get("type") or "Unknown"
        sync_status = payment.get("syncStatus")

        business_unit = payment.get("businessUnit") if isinstance(payment.get("businessUnit"), dict) else None
        bu_id = business_unit.get("id") if business_unit else None
        bu_name = business_unit.get("name") if business_unit else None

        memo = str(payment.get("memo") or "")

        if total > 0:
            total_collected += total
            successful_payment_count += 1
            collections_by_type[payment_type] += total

            if bu_id is not None:
                collections_by_business_unit[bu_id] += total
                bu_name_by_id[bu_id] = bu_name or str(bu_id)
        else:
            zero_amount_payment_count += 1

        if sync_status == "Pending":
            pending_sync_count += 1

        memo_lower = memo.lower()
        has_warning = (
            total == 0
            or "failed" in memo_lower
            or "error" in memo_lower
            or "does not have payment processor setup" in memo_lower
        )

        if has_warning:
            failed_or_warning_count += 1
            failed_or_warning_payments.append(
                {
                    "payment_id": payment.get("id"),
                    "created_on": payment.get("createdOn"),
                    "date": payment.get("date"),
                    "customer_name": payment.get("customer", {}).get("name")
                    if isinstance(payment.get("customer"), dict)
                    else None,
                    "business_unit": bu_name,
                    "type": payment_type,
                    "total": round(total, 2),
                    "sync_status": sync_status,
                    "memo": memo,
                }
            )

    average_collection = (
        total_collected / successful_payment_count if successful_payment_count else 0.0
    )

    return {
        "filters": {
            "startDate": start_date,
            "endDate": end_date,
            "businessUnitId": business_unit_id,
        },
        "summary": {
            "payments_seen": len(payments),
            "successful_payment_count": successful_payment_count,
            "zero_amount_payment_count": zero_amount_payment_count,
            "pending_sync_count": pending_sync_count,
            "failed_or_warning_count": failed_or_warning_count,
            "total_collected": round(total_collected, 2),
            "average_successful_payment": round(average_collection, 2),
        },
        "breakdowns": {
            "by_payment_type": [
                {"payment_type": key, "total_collected": round(value, 2)}
                for key, value in sorted(
                    collections_by_type.items(),
                    key=lambda x: x[1],
                    reverse=True,
                )
            ],
            "by_business_unit": _top_n(collections_by_business_unit, bu_name_by_id, n=10),
        },
        "details": {
            "failed_or_warning_payments": failed_or_warning_payments[:25],
        },
        "provenance": {
            "payment_rows": len(payments),
            "payment_pages": payments_resp.get("meta", {}).get("pages_fetched", 0),
        },
    }