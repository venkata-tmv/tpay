from __future__ import annotations

from typing import Any, Iterable


class MCPGuardrailViolation(Exception):
    pass


# Fields that should be hidden unless explicitly requested
DEFAULT_PII_FIELDS = {
    "phone",
    "phoneNumber",
    "mobilePhone",
    "email",
    "emailAddress",
    "address",
    "addressLine1",
    "addressLine2",
    "city",
    "postalCode",
    "zip",
}


def enforce_get_only(method: str) -> None:
    """
    Ensure only GET requests are allowed.
    """
    if method.upper() != "GET":
        raise MCPGuardrailViolation(
            f"MCP ServiceTitan explorer only allows GET operations, got: {method}"
        )


def enforce_row_limit(
    rows: Iterable[Any],
    max_rows: int,
) -> list[Any]:
    """
    Ensure responses do not exceed configured row limits.
    """
    rows_list = list(rows)

    if len(rows_list) > max_rows:
        raise MCPGuardrailViolation(
            f"Row limit exceeded: {len(rows_list)} rows returned (max {max_rows})"
        )

    return rows_list


def redact_pii(
    rows: list[dict[str, Any]],
    redact: bool = True,
    pii_fields: set[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Remove PII fields from response payloads.
    """
    if not redact:
        return rows

    pii_fields = pii_fields or DEFAULT_PII_FIELDS

    cleaned: list[dict[str, Any]] = []

    for row in rows:
        new_row = {}

        for key, value in row.items():
            if key in pii_fields:
                new_row[key] = "[REDACTED]"
            else:
                new_row[key] = value

        cleaned.append(new_row)

    return cleaned


def enforce_allowed_params(
    params: dict[str, Any],
    allowed_params: set[str],
) -> dict[str, Any]:
    """
    Prevent arbitrary query parameters.
    """
    filtered: dict[str, Any] = {}

    for key, value in params.items():
        if key not in allowed_params:
            raise MCPGuardrailViolation(
                f"Parameter '{key}' not allowed for this endpoint"
            )
        filtered[key] = value

    return filtered