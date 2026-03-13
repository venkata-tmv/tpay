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
    retry_count: int

    created_at: datetime
    executed_at: datetime | None


class PaymentListResponse(BaseModel):
    items: list[PaymentDetailResponse]
    total: int


class PaymentSummaryResponse(BaseModel):
    total_volume_today: Decimal
    total_volume_mtd: Decimal
    successful_payments_today: int
    failed_payments_today: int
    chargebacks_count: int
    total_payments_mtd: int
