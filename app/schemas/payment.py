from decimal import Decimal
from pydantic import BaseModel, Field


class PaymentIntentCreate(BaseModel):
    job_id: str
    invoice_id: str
    amount: Decimal = Field(gt=0)
    currency: str = "USD"
    idempotency_key: str


class PaymentResponse(BaseModel):
    payment_id: str
    status: str
