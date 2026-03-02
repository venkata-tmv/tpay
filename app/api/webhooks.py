from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Request, Depends, HTTPException
from httpx import request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.tilled_webhook import verify_tilled_signature, WebhookSignatureError
from app.models.payment import Payment, PaymentStatus
from app.models.webhook_event import WebhookEvent
from app.services.servicetitan_writeback_service import write_payment_to_servicetitan_invoice

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/tilled")
async def tilled_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    sig_header = request.headers.get("tilled-signature")

    # 1) Verify signature (must use raw body)
    try:
        verify_tilled_signature(
            header_value=sig_header,
            raw_body=raw_body,
            secret=settings.TILLED_WEBHOOK_SECRET,
            tolerance_seconds=settings.TILLED_WEBHOOK_TOLERANCE_SECONDS,
        )
    except WebhookSignatureError as exc:
        print("SIG VERIFY ERROR:", str(exc))
        raise HTTPException(status_code=400, detail=str(exc))

    # 2) Parse JSON only after verification
    event = await request.json()

    provider_event_id = event.get("id")
    event_type = event.get("type")
    account_id = event.get("account_id")  # often present in provider payload
    data = event.get("data") or {}
    provider_pi_id = data.get("id")  # payment intent id in your earlier mapping

    if not provider_event_id or not event_type:
        # Acknowledge so provider doesn't retry forever
        return {"received": True, "ignored": True, "reason": "missing id/type"}

    # 3) Insert webhook event first (idempotency + audit)
    webhook_row = WebhookEvent(
        provider="tilled",
        provider_event_id=provider_event_id,
        event_type=event_type,
        account_id=account_id,
        payload=event,
    )

    db.add(webhook_row)
    try:
        db.commit()
    except IntegrityError:
        # Duplicate provider_event_id => already received/processed
        db.rollback()
        return {"received": True, "duplicate": True}

    # 4) Resolve Payment (optional)
    payment: Payment | None = None
    if provider_pi_id:
        payment = (
            db.query(Payment)
            .filter(
                Payment.provider == "tilled",
                Payment.provider_payment_id == provider_pi_id,
            )
            .one_or_none()
        )

    # Store payment_id on webhook_events if found (helps debugging)
    if payment:
        webhook_row.payment_id = payment.id
        db.commit()

    # 5) Process event -> update payment status (best-effort)
    try:
        if not payment:
            webhook_row.processing_error = "payment not found for provider_pi_id"
            webhook_row.processed_at = datetime.utcnow()
            db.commit()
            return {"received": True, "ignored": True, "reason": "payment not found"}

        # Map event types
        if event_type == "payment_intent.succeeded":
            payment.status = PaymentStatus.SUCCEEDED
            payment.executed_at = datetime.utcnow()
            payment.failure_reason = None
            db.commit()

            # ✅ write back to ServiceTitan (idempotent)
            try:
                write_payment_to_servicetitan_invoice(
                    db=db,
                    payment_id=payment.id,
                    tenant=settings.ST_TENANT_ID,
                    webhook_event_id=provider_event_id,
                )
            except Exception as exc:
                webhook_row.processing_error = f"ST writeback failed: {exc}"
                db.commit()

        elif event_type == "payment_intent.payment_failed":
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = str(
                data.get("last_payment_error")
                or data.get("failure_reason")
                or "payment_failed"
            )

        elif event_type == "payment_intent.processing":
            payment.status = PaymentStatus.PROCESSING

        elif event_type == "payment_intent.requires_action":
            # keep in processing (or create a separate status later)
            payment.status = PaymentStatus.PROCESSING

        else:
            # unknown event type - still log it as processed
            webhook_row.processed_at = datetime.utcnow()
            db.commit()
            return {"received": True, "ignored": True, "reason": f"unhandled type {event_type}"}

        webhook_row.processed_at = datetime.utcnow()
        db.commit()

        return {"received": True}

    except Exception as exc:
        webhook_row.processing_error = str(exc)
        webhook_row.processed_at = datetime.utcnow()
        db.commit()
        return {"received": True, "processed": False, "error": "internal processing error"}
