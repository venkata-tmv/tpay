from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.payment import Payment, PaymentStatus
from app.schemas.payment_read import (
    PaymentDetailResponse,
    PaymentListResponse,
    PaymentSummaryResponse,
)

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
        retry_count=p.retry_count,
        created_at=p.created_at,
        executed_at=getattr(p, "executed_at", None),
    )


@router.get("/summary", response_model=PaymentSummaryResponse)
def get_payment_summary(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    month_start = datetime(now.year, now.month, 1)

    def _sum_amount(start_dt: datetime) -> Decimal:
        value = (
            db.query(func.coalesce(func.sum(Payment.amount), 0))
            .filter(Payment.created_at >= start_dt)
            .scalar()
        )
        return Decimal(value or 0)

    def _count_for_status(start_dt: datetime, status: PaymentStatus) -> int:
        return (
            db.query(func.count(Payment.id))
            .filter(Payment.created_at >= start_dt, Payment.status == status)
            .scalar()
            or 0
        )

    total_payments_mtd = (
        db.query(func.count(Payment.id))
        .filter(Payment.created_at >= month_start)
        .scalar()
        or 0
    )

    return PaymentSummaryResponse(
        total_volume_today=_sum_amount(today_start),
        total_volume_mtd=_sum_amount(month_start),
        successful_payments_today=_count_for_status(today_start, PaymentStatus.SUCCEEDED),
        failed_payments_today=_count_for_status(today_start, PaymentStatus.FAILED),
        chargebacks_count=0,
        total_payments_mtd=total_payments_mtd,
    )


@router.get("/", response_model=PaymentListResponse)
def list_payments(
    status: str | None = Query(default=None),
    job_id: str | None = Query(default=None),
    invoice_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
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

    if search:
        needle = f"%{search}%"
        q = q.filter(
            (Payment.job_id.ilike(needle))
            | (Payment.invoice_id.ilike(needle))
            | (Payment.id.ilike(needle))
        )

    if created_from:
        q = q.filter(Payment.created_at >= created_from)

    if created_to:
        q = q.filter(Payment.created_at <= created_to)

    total = q.count()
    items = q.order_by(Payment.created_at.desc()).offset(offset).limit(limit).all()

    return PaymentListResponse(
        items=[_to_payment_detail(p) for p in items],
        total=total,
    )


@router.get("/{payment_id}", response_model=PaymentDetailResponse)
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    return _to_payment_detail(p)
