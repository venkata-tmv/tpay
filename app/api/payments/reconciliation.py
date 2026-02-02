from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.reconciliation import ReconciliationRunResponse, ReconciliationExceptionItem
from app.services.reconciliation_service import run_reconciliation
from app.models.reconciliation import ReconciliationItem, ReconciliationItemStatus

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
def list_exceptions(db: Session = Depends(get_db)):
    items = (
        db.query(ReconciliationItem)
        .filter(
            ReconciliationItem.status.in_(
                [ReconciliationItemStatus.MISMATCH, ReconciliationItemStatus.MISSING]
            )
        )
        .all()
    )

    return [
        ReconciliationExceptionItem(
            payment_id=i.payment_id,
            provider_payment_id=i.provider_payment_id,
            expected_amount=float(i.expected_amount),
            actual_amount=float(i.actual_amount) if i.actual_amount is not None else None,
            status=i.status.value,
        )
        for i in items
    ]
