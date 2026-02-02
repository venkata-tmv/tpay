from datetime import date
from pydantic import BaseModel


class ReconciliationRunResponse(BaseModel):
    run_id: str
    report_date: date
    status: str


class ReconciliationExceptionItem(BaseModel):
    payment_id: str
    provider_payment_id: str | None
    expected_amount: float
    actual_amount: float | None
    status: str
