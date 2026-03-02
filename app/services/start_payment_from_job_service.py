from __future__ import annotations

import hashlib
from decimal import Decimal
from sqlalchemy.orm import Session

from app.schemas.payment import PaymentIntentCreate
from app.services.payment_service import create_payment_intent
from app.services.servicetitan_service import get_job_detail, get_invoice_core as get_invoice


def _stable_idempotency_key(job_id: int, invoice_id: int, amount: Decimal, currency: str) -> str:
    raw = f"st:job:{job_id}|inv:{invoice_id}|amt:{amount}|cur:{currency}".encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    return f"stjob_{digest}"  # short + stable


def _parse_money(value) -> Decimal:
    if value is None:
        raise ValueError("Invoice amount is missing")
    # ServiceTitan returns strings like "59152.96"
    return Decimal(str(value))


def start_payment_from_job(
    *,
    db: Session,
    job_id: int,
    amount_override: str | None = None,
    currency: str = "USD",
    amount_source: str = "total",  # total | balance
):
    # 1) Get job detail to find invoice id
    job = get_job_detail(job_id)
    invoice_id = job.get("invoiceId")
    if not invoice_id:
        raise ValueError("Job has no invoiceId yet (cannot start payment)")

    # 2) Get invoice
    invoice = get_invoice(int(invoice_id))

    # 3) Determine amount
    if amount_override is not None:
        amount = Decimal(amount_override)
    else:
        if amount_source == "balance":
            # Warning: in your sandbox AR isn't configured; balance may be 0.00 even for unpaid invoices
            amount = _parse_money(invoice.balance)
        else:
            amount = _parse_money(invoice.total)

    if amount <= 0:
        raise ValueError("Amount must be > 0 to start payment")

    # 4) Create internal TPay payment intent using existing service
    idem = _stable_idempotency_key(job_id=int(job_id), invoice_id=int(invoice_id), amount=amount, currency=currency)

    payload = PaymentIntentCreate(
        job_id=str(job_id),
        invoice_id=str(invoice_id),
        amount=amount,
        currency=currency,
        idempotency_key=idem,
    )

    payment = create_payment_intent(db, payload)

    return {
        "payment": payment,
        "job_id": int(job_id),
        "invoice_id": int(invoice_id),
        "amount": str(amount),
        "currency": currency,
        "idempotency_key": idem,
    }