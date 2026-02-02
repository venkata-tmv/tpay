from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
