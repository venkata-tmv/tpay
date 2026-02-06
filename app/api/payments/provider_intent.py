from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.provider_intent import ProviderIntentCreateRequest, ProviderIntentResponse
from app.models.payment import Payment, PaymentStatus
from app.clients.tilled_client import TilledClient

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/{payment_id}/provider-intent", response_model=ProviderIntentResponse)
def create_provider_intent(payment_id: str, payload: ProviderIntentCreateRequest, db: Session = Depends(get_db)):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # We only allow intent creation before success (you can tune this rule later)
    if payment.status == PaymentStatus.SUCCEEDED:
        raise HTTPException(status_code=400, detail="Payment already succeeded")

    # Create provider Payment Intent in Tilled
    tilled = TilledClient()
    try:
        pi = tilled.create_payment_intent(
            amount=payment.amount,
            currency=payment.currency,
            confirm=payload.confirm,
            payment_method_id=payload.payment_method_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Persist provider Payment Intent id (do NOT store client_secret in DB)
    payment.provider = "tilled"
    payment.provider_payment_id = pi.get("id")
    db.commit()
    db.refresh(payment)

    return ProviderIntentResponse(
        payment_id=payment.id,
        provider_payment_intent_id=pi.get("id"),
        client_secret=pi.get("client_secret"),
        provider_status=pi.get("status"),
    )
