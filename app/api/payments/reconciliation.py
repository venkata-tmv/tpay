from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.payment import Payment
from app.models.reconciliation import (
    ReconciliationItem,
    ReconciliationItemStatus,
    ReconciliationRun,
    ReconciliationRunStatus,
)
from app.schemas.reconciliation import (
    ReconciliationExceptionDetail,
    ReconciliationExceptionItem,
    ReconciliationRunHistoryItem,
    ReconciliationRunResponse,
    ReconciliationSummaryResponse,
)
from app.services.reconciliation_service import run_reconciliation

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/run", response_model=ReconciliationRunResponse)
def run_recon(report_date: date, db: Session = Depends(get_db)):
    run = run_reconciliation(db, report_date)
    return ReconciliationRunResponse(run_id=run.id, report_date=run.report_date, status=run.status.value)

@router.get("/exceptions", response_model=list[ReconciliationExceptionItem])
def list_exceptions(
    db: Session = Depends(get_db),
    run_id: str | None = Query(default=None),
):
    q = db.query(ReconciliationItem).filter(
        ReconciliationItem.status.in_(
            [ReconciliationItemStatus.MISMATCH, ReconciliationItemStatus.MISSING]
        )
    )

    if run_id:
        q = q.filter(ReconciliationItem.run_id == run_id)

    items = q.all()

    return [
        ReconciliationExceptionItem(
            payment_id=i.payment_id,
            provider_payment_id=i.provider_payment_id,
            expected_amount=float(i.expected_amount),
            actual_amount=float(i.actual_amount) if i.actual_amount is not None else None,
            status=i.status.value,
            run_id=i.run_id,
            internal_status=i.internal_status,
            provider_status=i.provider_status,
            error=i.error,
            created_at=i.created_at.isoformat() if i.created_at else None,
        )
        for i in items
    ]


@router.get("/summary", response_model=ReconciliationSummaryResponse)
def get_reconciliation_summary(db: Session = Depends(get_db)):
    runs = (
        db.query(ReconciliationRun)
        .order_by(ReconciliationRun.created_at.desc())
        .limit(10)
        .all()
    )

    history: list[ReconciliationRunHistoryItem] = []
    for run in runs:
        matched_count = (
            db.query(func.count(ReconciliationItem.id))
            .filter(
                ReconciliationItem.run_id == run.id,
                ReconciliationItem.status == ReconciliationItemStatus.MATCHED,
            )
            .scalar()
            or 0
        )
        exception_count = (
            db.query(func.count(ReconciliationItem.id))
            .filter(
                ReconciliationItem.run_id == run.id,
                ReconciliationItem.status.in_(
                    [ReconciliationItemStatus.MISMATCH, ReconciliationItemStatus.MISSING]
                ),
            )
            .scalar()
            or 0
        )
        history.append(
            ReconciliationRunHistoryItem(
                run_id=run.id,
                report_date=run.report_date,
                status=run.status.value,
                created_at=run.created_at.isoformat(),
                matched_count=matched_count,
                exception_count=exception_count,
            )
        )

    latest_run = runs[0] if runs else None
    missing_count = 0
    mismatch_count = 0
    matched_count = 0
    exception_count = 0

    if latest_run:
        matched_count = next((item.matched_count for item in history if item.run_id == latest_run.id), 0)
        exception_count = next((item.exception_count for item in history if item.run_id == latest_run.id), 0)
        missing_count = (
            db.query(func.count(ReconciliationItem.id))
            .filter(
                ReconciliationItem.run_id == latest_run.id,
                ReconciliationItem.status == ReconciliationItemStatus.MISSING,
            )
            .scalar()
            or 0
        )
        mismatch_count = (
            db.query(func.count(ReconciliationItem.id))
            .filter(
                ReconciliationItem.run_id == latest_run.id,
                ReconciliationItem.status == ReconciliationItemStatus.MISMATCH,
            )
            .scalar()
            or 0
        )

    return ReconciliationSummaryResponse(
        last_run_id=latest_run.id if latest_run else None,
        last_report_date=latest_run.report_date if latest_run else None,
        last_run_at=latest_run.created_at.isoformat() if latest_run else None,
        matched_count=matched_count,
        exception_count=exception_count,
        missing_count=missing_count,
        mismatch_count=mismatch_count,
        history=history,
    )


@router.get("/runs", response_model=list[ReconciliationRunHistoryItem])
def list_reconciliation_runs(db: Session = Depends(get_db)):
    summary = get_reconciliation_summary(db)
    return summary.history


@router.get("/exceptions/{payment_id}", response_model=ReconciliationExceptionDetail)
def get_exception_detail(payment_id: str, run_id: str | None = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(ReconciliationItem).filter(ReconciliationItem.payment_id == payment_id)
    if run_id:
        q = q.filter(ReconciliationItem.run_id == run_id)

    item = q.order_by(ReconciliationItem.created_at.desc()).first()
    if not item:
        raise HTTPException(status_code=404, detail="Reconciliation exception not found")

    payment = db.get(Payment, payment_id)
    mismatch_reasons = item.mismatch_reasons if isinstance(item.mismatch_reasons, list) else []
    difference = None
    if item.actual_amount is not None:
        difference = float(item.actual_amount - item.expected_amount)

    run = db.get(ReconciliationRun, item.run_id)

    return ReconciliationExceptionDetail(
        payment_id=item.payment_id,
        run_id=item.run_id,
        status=item.status.value,
        expected_amount=float(item.expected_amount),
        actual_amount=float(item.actual_amount) if item.actual_amount is not None else None,
        settlement_date=run.report_date if run else None,
        internal_status=item.internal_status,
        provider_status=item.provider_status,
        provider_payment_id=item.provider_payment_id,
        difference=difference,
        error=item.error,
        mismatch_reasons=mismatch_reasons,
        job_id=payment.job_id if payment else None,
        invoice_id=payment.invoice_id if payment else None,
        created_at=item.created_at.isoformat(),
        payment_created_at=payment.created_at.isoformat() if payment else None,
        payment_executed_at=payment.executed_at.isoformat() if payment and payment.executed_at else None,
    )
