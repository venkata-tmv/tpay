import uuid
from datetime import date, datetime, time
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.payment import Payment, PaymentStatus
from app.models.reconciliation import (
    ReconciliationRun,
    ReconciliationItem,
    ReconciliationRunStatus,
    ReconciliationItemStatus,
)
from app.clients.tilled_client import TilledClient


def _date_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, time.min)
    end = datetime.combine(d, time.max)
    return start, end


def run_reconciliation(db: Session, report_date: date) -> ReconciliationRun:
    """
    Real reconciliation (MVP):
    - Take local SUCCEEDED payments for the report_date window
    - For each payment, fetch provider Payment Intent from Tilled (by provider_payment_id = pi_...)
    - Compare provider status + amount
    - Write reconciliation items (MATCHED / MISMATCH / MISSING)
    """
    run = ReconciliationRun(
        id=str(uuid.uuid4()),
        report_date=report_date,
        status=ReconciliationRunStatus.RUNNING,
    )
    db.add(run)
    db.flush()

    start_dt, end_dt = _date_bounds(report_date)

    # MVP: reconcile only SUCCEEDED payments in date window.
    # If you prefer executed_at, switch created_at -> executed_at when you have it.
    payments = (
        db.query(Payment)
        .filter(Payment.status == PaymentStatus.SUCCEEDED)
        .filter(Payment.created_at >= start_dt)
        .filter(Payment.created_at <= end_dt)
        .all()
    )

    tilled = TilledClient()

    for p in payments:
        expected_amount: Decimal = p.amount
        provider_pi_id = p.provider_payment_id  # expected to be pi_...

        # If missing provider id, we cannot reconcile
        if not provider_pi_id:
            item = ReconciliationItem(
                id=str(uuid.uuid4()),
                run_id=run.id,
                payment_id=p.id,
                provider_payment_id=None,
                expected_amount=expected_amount,
                actual_amount=None,
                status=ReconciliationItemStatus.MISSING,
            )
            db.add(item)
            continue

        try:
            pi = tilled.get_payment_intent(provider_pi_id)
        except Exception:
            # provider record missing / fetch failed -> mark MISSING
            item = ReconciliationItem(
                id=str(uuid.uuid4()),
                run_id=run.id,
                payment_id=p.id,
                provider_payment_id=provider_pi_id,
                expected_amount=expected_amount,
                actual_amount=None,
                status=ReconciliationItemStatus.MISSING,
            )
            db.add(item)
            continue

        # Tilled PI fields typically include: amount (cents int), status (string)
        provider_amount_cents = pi.get("amount")
        provider_amount = (
            (Decimal(provider_amount_cents) / Decimal("100")).quantize(Decimal("0.01"))
            if provider_amount_cents is not None
            else None
        )
        provider_status = (pi.get("status") or "").lower()

        amount_match = (provider_amount is not None and provider_amount == expected_amount)
        status_ok = (provider_status == "succeeded")

        if amount_match and status_ok:
            status = ReconciliationItemStatus.MATCHED
        else:
            status = ReconciliationItemStatus.MISMATCH

        item = ReconciliationItem(
            id=str(uuid.uuid4()),
            run_id=run.id,
            payment_id=p.id,
            provider_payment_id=provider_pi_id,
            expected_amount=expected_amount,
            actual_amount=provider_amount,
            status=status,
        )
        db.add(item)

    run.status = ReconciliationRunStatus.COMPLETED
    db.commit()
    db.refresh(run)
    return run
