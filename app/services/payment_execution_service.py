from sqlalchemy.orm import Session

from app.models.payment import Payment, PaymentStatus
from app.clients.tilled_client import TilledClient


def execute_payment(db: Session, payment_id: str) -> Payment:
    payment = db.get(Payment, payment_id)

    if not payment:
        raise ValueError("Payment not found")

    if payment.status != PaymentStatus.INITIATED:
        raise ValueError("Payment is not in executable state")

    # Move to PROCESSING
    payment.status = PaymentStatus.PROCESSING
    db.commit()

    tilled = TilledClient()
    result = tilled.execute_payment(payment.amount, payment.currency)

    if result["success"]:
        payment.status = PaymentStatus.SUCCEEDED
        payment.provider = "tilled"
        payment.provider_payment_id = result["provider_payment_id"]
    else:
        payment.status = PaymentStatus.FAILED
        payment.failure_reason = result["error"]

    db.commit()
    return payment
