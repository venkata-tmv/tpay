from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal
from app.services.servicetitan_service import get_invoice_core
import hashlib
from app.core.database import SessionLocal
from app.schemas.payment import (
    PaymentIntentCreate,
    PaymentResponse,
)
from app.services.payment_service import create_payment_intent

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/intents",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment_intent_api(
    payload: PaymentIntentCreate,
    db: Session = Depends(get_db),
):
    try:
        payment = create_payment_intent(db, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return PaymentResponse(
        payment_id=payment.id,
        status=payment.status.value,
    )

@router.post(
    "/intents/from-servicetitan-invoice/{invoice_id}",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_intent_from_servicetitan_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    inv = get_invoice_core(invoice_id)

    if inv.balance <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice balance is 0. Invoice is already paid or has no amount due.",
        )

    # Deterministic idempotency key (same invoice + balance => same key)
    raw = f"st:{invoice_id}:{inv.balance}"
    idem = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    payload = PaymentIntentCreate(
        job_id=str(inv.job_id),
        invoice_id=str(inv.invoice_id),
        amount=inv.balance,
        currency="USD",
        idempotency_key=idem,
    )

    try:
        payment = create_payment_intent(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return PaymentResponse(payment_id=payment.id, status=payment.status.value)