from sqlalchemy.orm import Session

from app.models.payment import Payment, PaymentStatus
from app.clients.tilled_client import TilledClient
from app.core.config import settings


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

    try:
        # MVP: use a pre-created sandbox payment_method_id
        pi = tilled.create_payment_intent(
            amount=payment.amount,
            currency=payment.currency,
            payment_method_id=settings.TILLED_TEST_PAYMENT_METHOD_ID,
        )

        # store provider IDs (exact fields depend on Tilled response)
        payment.status = PaymentStatus.SUCCEEDED
        payment.provider = "tilled"
        payment.provider_payment_id = pi.get("id")  # payment_intent id

    except Exception as e:
        payment.status = PaymentStatus.FAILED
        payment.failure_reason = str(e)

    db.commit()
    return payment
