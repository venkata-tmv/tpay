from __future__ import annotations

from typing import Any

from app.clients.servicetitan_client import ServiceTitanClient
from app.core.config import settings
from app.models.payment import Payment
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime


def write_tpay_reference_to_invoice(
    *,
    invoice_id: int,
    custom_fields: dict[str, str],
    tenant: str | None = None,
) -> dict[str, Any]:
    """
    Writes TPay/Tilled references back to ServiceTitan invoice using custom fields.
    """
    tenant = tenant or settings.ST_TENANT_ID

    ops = [{
        "objectId": invoice_id,
        "customFields": [{"name": k, "value": v} for k, v in custom_fields.items()],
    }]

    client = ServiceTitanClient()
    return client.patch_invoice_custom_fields(tenant=tenant, operations=ops)

class STWritebackError(Exception):
    pass


def write_payment_to_servicetitan_invoice(
    *,
    db: Session,
    payment_id: str,
    tenant: str | None = None,
    webhook_event_id: str | None = None,
) -> Payment:
    """
    Idempotent write-back:
    - Locks Payment row (FOR UPDATE)
    - If already succeeded -> no-op
    - Otherwise POST payment to ST and store st_payment_id + status
    """
    tenant = tenant or settings.ST_TENANT_ID

    p: Payment | None = (
        db.query(Payment)
        .filter(Payment.id == payment_id)
        .with_for_update()
        .one_or_none()
    )
    if not p:
        raise STWritebackError("Payment not found")

    # ✅ idempotency gate
    if p.st_writeback_status == "succeeded" and p.st_payment_id:
        return p

    # mark as processing
    p.st_writeback_status = "processing"
    p.st_writeback_error = None
    db.commit()
    db.refresh(p)

    memo = f"{settings.ST_PAYMENT_MEMO_PREFIX}|payment_id={p.id}"
    if webhook_event_id:
        memo += f"|webhook_event_id={webhook_event_id}"
    if p.provider_payment_id:
        memo += f"|tilled_pi={p.provider_payment_id}"

    amount: Decimal = p.amount

    payload: dict[str, Any] = {
        "typeId": int(settings.ST_PAYMENT_TYPE_ID),
        "memo": memo,
        "paidOn": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "splits": [
            {
                "invoiceId": int(p.invoice_id),
                "amount": float(amount),  # if ST rejects floats, switch to str(amount)
            }
        ],
    }

    client = ServiceTitanClient()
    try:
        resp = client.create_payment(tenant=tenant, payload=payload)
        data = (resp or {}).get("data") or {}
        st_payment_id = data.get("id")
        if st_payment_id is None:
            raise STWritebackError(f"ServiceTitan create_payment returned no id: {resp}")

        p.st_payment_id = str(st_payment_id)
        p.st_writeback_status = "succeeded"
        p.st_writeback_error = None
        p.st_written_back_at = datetime.utcnow()

        db.commit()
        db.refresh(p)
        return p

    except Exception as exc:
        p.st_writeback_status = "failed"
        p.st_writeback_error = str(exc)
        db.commit()
        db.refresh(p)
        raise