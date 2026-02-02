from datetime import datetime
from sqlalchemy.orm import Session

from app.models.payment import Payment, PaymentStatus
from app.clients.tilled_client import TilledClient

MAX_RETRIES = 3


def execute_payment(db: Session, payment_id: str, idempotency_key: str) -> Payment:
    # Lock row to prevent two requests executing simultaneously
    payment = (
        db.query(Payment)
        .filter(Payment.id == payment_id)
        .with_for_update()
        .one_or_none()
    )

    if not payment:
        raise ValueError("Payment not found")

    # ✅ If already succeeded, treat as idempotent success
    if payment.status == PaymentStatus.SUCCEEDED:
        return payment

    # ✅ If execution already attempted, enforce idempotency
    if payment.execute_idempotency_key is not None:
        if payment.execute_idempotency_key == idempotency_key:
            return payment
        raise ValueError("Execution already attempted with a different Idempotency-Key")

    # ✅ State rules
    if payment.status == PaymentStatus.INITIATED:
        pass
    elif payment.status == PaymentStatus.FAILED:
        if payment.retry_count >= MAX_RETRIES:
            raise ValueError("Retry limit exceeded")
        payment.retry_count += 1
    else:
        raise ValueError("Payment is not in executable state")

    # Save idempotency key for execution
    payment.execute_idempotency_key = idempotency_key

    # Move to PROCESSING
    payment.status = PaymentStatus.PROCESSING
    db.flush()  # keep transaction open

    tilled = TilledClient()
    result = tilled.execute_payment(payment.amount, payment.currency)

    if result["success"]:
        payment.status = PaymentStatus.SUCCEEDED
        payment.executed_at = datetime.utcnow()
        payment.provider = "tilled"
        payment.provider_payment_id = result["provider_payment_id"]
    else:
        payment.status = PaymentStatus.FAILED
        payment.failure_reason = result["error"]

    db.commit()
    db.refresh(payment)
    return payment
