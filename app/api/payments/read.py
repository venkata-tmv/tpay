from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.payment import Payment
from app.schemas.payment_read import PaymentDetailResponse, PaymentListResponse

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _to_payment_detail(p: Payment) -> PaymentDetailResponse:
    return PaymentDetailResponse(
        id=p.id,
        job_id=p.job_id,
        invoice_id=p.invoice_id,
        amount=p.amount,
        currency=p.currency,
        status=p.status.value if hasattr(p.status, "value") else str(p.status),
        idempotency_key=p.idempotency_key,
        provider=p.provider,
        provider_payment_id=p.provider_payment_id,
        failure_reason=p.failure_reason,
        created_at=p.created_at,
        executed_at=getattr(p, "executed_at", None),
    )


@router.get("/{payment_id}", response_model=PaymentDetailResponse)
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    return _to_payment_detail(p)


@router.get("/", response_model=PaymentListResponse)
def list_payments(
    status: str | None = Query(default=None),
    job_id: str | None = Query(default=None),
    invoice_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Payment)

    if status:
        # status stored as Enum; compare using string value
        q = q.filter(Payment.status == status)

    if job_id:
        q = q.filter(Payment.job_id == job_id)

    if invoice_id:
        q = q.filter(Payment.invoice_id == invoice_id)

    total = q.count()
    items = q.order_by(Payment.created_at.desc()).offset(offset).limit(limit).all()

    return PaymentListResponse(
        items=[_to_payment_detail(p) for p in items],
        total=total,
    )
