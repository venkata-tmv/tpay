import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional

from httpx import HTTPStatusError, RequestError
from sqlalchemy.orm import Session

from app.clients.tilled_client import TilledClient
from app.models.payment import Payment, PaymentStatus
from app.models.reconciliation import (
    ReconciliationItem,
    ReconciliationItemStatus,
    ReconciliationRun,
    ReconciliationRunStatus,
)
from app.services.servicetitan_service import get_invoice_core


def _date_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, time.min)
    end = datetime.combine(d, time.max)
    return start, end


def _canonical_internal_status(s: PaymentStatus) -> str:
    if s == PaymentStatus.SUCCEEDED:
        return "succeeded"
    if s == PaymentStatus.FAILED:
        return "failed"
    return "pending"  # initiated/processing/anything else


def _canonical_provider_status(raw: str | None) -> str:
    s = (raw or "").lower()
    if s in ("succeeded",):
        return "succeeded"
    if s in ("failed", "canceled", "cancelled"):
        return "failed"
    return "pending"


def run_reconciliation(db: Session, report_date: date) -> ReconciliationRun:
    run = ReconciliationRun(
        id=str(uuid.uuid4()),
        report_date=report_date,
        status=ReconciliationRunStatus.RUNNING,
    )
    db.add(run)
    db.flush()

    start_dt, end_dt = _date_bounds(report_date)
    tilled = TilledClient()

    # PROD: include anything that is “in play” and relevant to that day
    payments = (
        db.query(Payment)
        .filter(
            (
                (
                    Payment.executed_at.isnot(None)
                    & (Payment.executed_at >= start_dt)
                    & (Payment.executed_at <= end_dt)
                )
                | (
                    Payment.executed_at.is_(None)
                    & (Payment.created_at >= start_dt)
                    & (Payment.created_at <= end_dt)
                )
            )
        )
        .filter(
            (Payment.provider_payment_id.isnot(None))
            | (Payment.status.in_([PaymentStatus.SUCCEEDED, PaymentStatus.FAILED]))
        )
        .all()
    )

    def _add_item(
        *,
        payment: Payment,
        provider_payment_id: Optional[str],
        expected_amount: Decimal,
        actual_amount: Optional[Decimal],
        item_status: ReconciliationItemStatus,
        internal_status: Optional[str],
        provider_status: Optional[str],
        reasons: Optional[List[str]],
        error: Optional[str],
        st_expected: Optional[Decimal] = None,
        st_actual: Optional[Decimal] = None,
        st_match: Optional[bool] = None,
    ) -> None:
        db.add(
            ReconciliationItem(
                id=str(uuid.uuid4()),
                run_id=run.id,
                payment_id=payment.id,
                provider_payment_id=provider_payment_id,
                expected_amount=expected_amount,
                actual_amount=actual_amount,
                internal_status=internal_status,
                provider_status=provider_status,
                mismatch_reasons=reasons or None,
                error=error,
                st_balance_expected=st_expected,
                st_balance_actual=st_actual,
                st_balance_match=st_match,
                status=item_status,
            )
        )

    try:
        for p in payments:
            expected_amount: Decimal = p.amount
            provider_pi_id = p.provider_payment_id

            internal_status_str = str(p.status)  # e.g. "PaymentStatus.SUCCEEDED" or "SUCCEEDED"
            # Prefer a clean value if your enum stringifies oddly
            if internal_status_str.startswith("PaymentStatus."):
                internal_status_str = internal_status_str.split(".", 1)[1]

            internal_state = _canonical_internal_status(p.status)

            # Missing provider id is a recon finding in prod
            if not provider_pi_id:
                reasons = ["PROVIDER_PAYMENT_ID_MISSING"]
                # If internal is final but provider missing, that's severe; keep MISSING.
                _add_item(
                    payment=p,
                    provider_payment_id=None,
                    expected_amount=expected_amount,
                    actual_amount=None,
                    item_status=ReconciliationItemStatus.MISSING,
                    internal_status=internal_status_str,
                    provider_status=None,
                    reasons=reasons,
                    error=None,
                )
                continue

            # Fetch provider record
            pi = None
            provider_status_raw: Optional[str] = None
            try:
                pi = tilled.get_payment_intent(provider_pi_id)
                provider_status_raw = pi.get("status")
            except HTTPStatusError as exc:
                code = exc.response.status_code
                body = exc.response.text

                if code == 404:
                    _add_item(
                        payment=p,
                        provider_payment_id=provider_pi_id,
                        expected_amount=expected_amount,
                        actual_amount=None,
                        item_status=ReconciliationItemStatus.MISSING,
                        internal_status=internal_status_str,
                        provider_status=None,
                        reasons=["PROVIDER_NOT_FOUND"],
                        error=f"HTTP {code}: {body}",
                    )
                else:
                    # Provider error (401/403/429/5xx) – surface as mismatch (retry-able)
                    _add_item(
                        payment=p,
                        provider_payment_id=provider_pi_id,
                        expected_amount=expected_amount,
                        actual_amount=None,
                        item_status=ReconciliationItemStatus.MISMATCH,
                        internal_status=internal_status_str,
                        provider_status=None,
                        reasons=["PROVIDER_FETCH_ERROR"],
                        error=f"HTTP {code}: {body}",
                    )
                continue
            except RequestError as exc:
                # Network / timeout
                _add_item(
                    payment=p,
                    provider_payment_id=provider_pi_id,
                    expected_amount=expected_amount,
                    actual_amount=None,
                    item_status=ReconciliationItemStatus.MISMATCH,
                    internal_status=internal_status_str,
                    provider_status=None,
                    reasons=["PROVIDER_NETWORK_ERROR"],
                    error=str(exc),
                )
                continue

            # Parse provider amount
            provider_amount_cents = pi.get("amount") if pi else None
            provider_amount = (
                (Decimal(provider_amount_cents) / Decimal("100")).quantize(Decimal("0.01"))
                if provider_amount_cents is not None
                else None
            )

            provider_state = _canonical_provider_status(provider_status_raw)

            reasons: List[str] = []

            # Amount mismatch
            if provider_amount is None:
                reasons.append("PROVIDER_AMOUNT_MISSING")
            elif provider_amount != expected_amount:
                reasons.append("AMOUNT_MISMATCH")

            # Status mismatch (this is the “why” you were missing)
            if provider_state != internal_state:
                reasons.append("STATUS_MISMATCH")

            # 3-way ST balance check (only if snapshot exists)
            st_expected = None
            st_actual = None
            st_match = None
            if p.st_invoice_balance is not None:
                st_expected = (p.st_invoice_balance - expected_amount)
                if st_expected < Decimal("0"):
                    st_expected = Decimal("0.00")
                try:
                    st_inv = get_invoice_core(int(p.invoice_id))
                    st_actual = st_inv.balance
                    st_match = abs(st_actual - st_expected) <= Decimal("0.01")
                    if st_match is False:
                        reasons.append("ST_BALANCE_MISMATCH")
                except Exception as exc:
                    # Don't fail the entire item; store a hint
                    reasons.append("ST_FETCH_ERROR")
                    # Keep st_match as None; set error text (optional)
                    # We won't overwrite provider errors; just include in item error.
                    st_match = None

            item_status = (
                ReconciliationItemStatus.MATCHED
                if len(reasons) == 0
                else ReconciliationItemStatus.MISMATCH
            )

            _add_item(
                payment=p,
                provider_payment_id=provider_pi_id,
                expected_amount=expected_amount,
                actual_amount=provider_amount,
                item_status=item_status,
                internal_status=internal_status_str,
                provider_status=provider_status_raw,
                reasons=reasons,
                error=None,
                st_expected=st_expected,
                st_actual=st_actual,
                st_match=st_match,
            )

        run.status = ReconciliationRunStatus.COMPLETED
        db.commit()
        db.refresh(run)
        return run

    except Exception:
        run.status = ReconciliationRunStatus.FAILED
        db.commit()
        db.refresh(run)
        return run