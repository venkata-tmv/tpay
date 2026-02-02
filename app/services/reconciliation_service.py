import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.payment import Payment, PaymentStatus
from app.models.reconciliation import (
    ReconciliationRun,
    ReconciliationItem,
    ReconciliationRunStatus,
    ReconciliationItemStatus,
)


def _mock_tilled_reconciliation_report(report_date: date) -> dict[str, Decimal]:
    """
    Mock report: provider_payment_id -> settled amount
    Later replace with real Tilled reconciliation/report API.
    """
    return {
        # Example: if provider_payment_id equals this, it is "settled"
        "tilled_txn_mock_123": Decimal("250.75"),
    }


def run_reconciliation(db: Session, report_date: date) -> ReconciliationRun:
    run = ReconciliationRun(
        id=str(uuid.uuid4()),
        report_date=report_date,
        status=ReconciliationRunStatus.RUNNING,
    )
    db.add(run)
    db.flush()

    tilled_report = _mock_tilled_reconciliation_report(report_date)

    # MVP: reconcile only SUCCEEDED payments
    payments = db.query(Payment).filter(Payment.status == PaymentStatus.SUCCEEDED).all()

    for p in payments:
        expected = p.amount
        provider_id = p.provider_payment_id

        if not provider_id or provider_id not in tilled_report:
            status = ReconciliationItemStatus.MISSING
            actual = None
        else:
            actual = tilled_report[provider_id]
            status = ReconciliationItemStatus.MATCHED if actual == expected else ReconciliationItemStatus.MISMATCH

        item = ReconciliationItem(
            id=str(uuid.uuid4()),
            run_id=run.id,
            payment_id=p.id,
            provider_payment_id=provider_id,
            expected_amount=expected,
            actual_amount=actual,
            status=status,
        )
        db.add(item)

    run.status = ReconciliationRunStatus.COMPLETED
    db.commit()
    db.refresh(run)
    return run
    