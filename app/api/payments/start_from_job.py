from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.start_payment_from_job import (
    StartPaymentFromJobRequest,
    StartPaymentFromJobResponse,
)
from app.services.start_payment_from_job_service import start_payment_from_job

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/from-job/{job_id}", response_model=StartPaymentFromJobResponse)
def start_payment_from_job_api(
    job_id: int,
    body: StartPaymentFromJobRequest,
    db: Session = Depends(get_db),
):
    try:
        result = start_payment_from_job(
            db=db,
            job_id=job_id,
            amount_override=body.amount,
            currency=body.currency or "USD",
            amount_source=body.amount_source or "total",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        # If ST call fails it will bubble here as 502 already in your ST client wrappers
        raise HTTPException(status_code=502, detail=str(exc))

    payment = result["payment"]

    return StartPaymentFromJobResponse(
        payment_id=payment.id,
        status=payment.status.value,
        job_id=result["job_id"],
        invoice_id=result["invoice_id"],
        amount=result["amount"],
        currency=result["currency"],
        idempotency_key=result["idempotency_key"],
    )