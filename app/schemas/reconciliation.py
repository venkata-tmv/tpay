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
    run_id: str | None = None
    internal_status: str | None = None
    provider_status: str | None = None
    error: str | None = None
    created_at: str | None = None


class ReconciliationRunHistoryItem(BaseModel):
    run_id: str
    report_date: date
    status: str
    created_at: str
    matched_count: int
    exception_count: int


class ReconciliationSummaryResponse(BaseModel):
    last_run_id: str | None
    last_report_date: date | None
    last_run_at: str | None
    matched_count: int
    exception_count: int
    missing_count: int
    mismatch_count: int
    history: list[ReconciliationRunHistoryItem]


class ReconciliationExceptionDetail(BaseModel):
    payment_id: str
    run_id: str
    status: str
    expected_amount: float
    actual_amount: float | None
    settlement_date: date | None
    internal_status: str | None
    provider_status: str | None
    provider_payment_id: str | None
    difference: float | None
    error: str | None
    mismatch_reasons: list[str]
    job_id: str | None
    invoice_id: str | None
    created_at: str
    payment_created_at: str | None
    payment_executed_at: str | None
