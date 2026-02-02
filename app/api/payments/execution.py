from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.payment_execution import PaymentExecuteResponse
from app.services.payment_execution_service import execute_payment

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/{payment_id}/execute", response_model=PaymentExecuteResponse)
def execute_payment(payment_id: str, db: Session = Depends(get_db)):
    try:
        payment = execute_payment(db, payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return PaymentExecuteResponse(
        payment_id=payment.id,
        status=payment.status.value,
    )
