from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.tilled_webhook import verify_tilled_signature, WebhookSignatureError
from app.models.payment import Payment, PaymentStatus

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/tilled")
async def tilled_webhook(request: Request, db: Session = Depends(get_db)):
    # 1) Read raw body (must use raw bytes for signature validation)
    raw_body = await request.body()

    # 2) Verify signature
    sig_header = request.headers.get("payments-signature")
    try:
        verify_tilled_signature(
            header_value=sig_header,
            raw_body=raw_body,
            secret=settings.TILLED_WEBHOOK_SECRET,
            tolerance_seconds=settings.TILLED_WEBHOOK_TOLERANCE_SECONDS,
        )
    except WebhookSignatureError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # 3) Parse JSON after signature verification
    event = await request.json()

    event_type = event.get("type")
    data = event.get("data") or {}
    provider_pi_id = data.get("id")  # payment intent id from Tilled sample payload :contentReference[oaicite:4]{index=4}

    if not provider_pi_id:
        # Acknowledge but do nothing; prevents retries for events we can't use
        return {"received": True, "ignored": True, "reason": "missing data.id"}

    # 4) Find our payment by provider_payment_id (we store PI id there)
    payment: Payment | None = (
        db.query(Payment)
        .filter(Payment.provider == "tilled", Payment.provider_payment_id == provider_pi_id)
        .one_or_none()
    )

    if not payment:
        # Same approach: acknowledge, log later (you can add a "dead letter" table later)
        return {"received": True, "ignored": True, "reason": "payment not found"}

    # 5) Map event type -> internal status
    # Tilled webhook event list includes payment_intent.succeeded/payment_failed/processing/requires_action :contentReference[oaicite:5]{index=5}
    if event_type == "payment_intent.succeeded":
        # Idempotent: if already succeeded, return 200
        payment.status = PaymentStatus.SUCCEEDED
        payment.executed_at = datetime.utcnow()
        payment.failure_reason = None

    elif event_type == "payment_intent.payment_failed":
        payment.status = PaymentStatus.FAILED
        # Tilled payload may include error fields; keep it safe:
        payment.failure_reason = str(data.get("last_payment_error") or data.get("failure_reason") or "payment_failed")

    elif event_type == "payment_intent.processing":
        payment.status = PaymentStatus.PROCESSING

    elif event_type == "payment_intent.requires_action":
        # Keep as processing or initiated depending on your preference; processing is fine for MVP
        payment.status = PaymentStatus.PROCESSING

    else:
        # Acknowledge unknown events
        return {"received": True, "ignored": True, "reason": f"unhandled type {event_type}"}

    db.commit()
    return {"received": True}
