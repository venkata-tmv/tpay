import uuid
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.payment import Payment, PaymentStatus


def create_payment_intent(
    db: Session,
    payload,
) -> Payment:
    payment = Payment(
        id=str(uuid.uuid4()),
        job_id=payload.job_id,
        invoice_id=payload.invoice_id,
        amount=payload.amount,
        currency=payload.currency,
        status=PaymentStatus.INITIATED,
        idempotency_key=payload.idempotency_key,
    )

    db.add(payment)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Payment already exists for this idempotency key")

    return payment
