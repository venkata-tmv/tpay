from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class PaymentDetailResponse(BaseModel):
    id: str
    job_id: str
    invoice_id: str
    amount: Decimal
    currency: str
    status: str

    idempotency_key: str

    provider: str | None
    provider_payment_id: str | None
    failure_reason: str | None

    created_at: datetime
    executed_at: datetime | None


class PaymentListResponse(BaseModel):
    items: list[PaymentDetailResponse]
    total: int
