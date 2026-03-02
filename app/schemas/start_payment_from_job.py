from pydantic import BaseModel, Field


class StartPaymentFromJobRequest(BaseModel):
    """
    You can override amount/currency if needed, otherwise we pull from invoice.total and USD.
    """
    amount: str | None = Field(default=None, description="Override amount (e.g., '59.99')")
    currency: str | None = Field(default="USD", description="Default USD")
    amount_source: str | None = Field(
        default="total",
        description="Which invoice field to use: total | balance (balance not reliable until AR is set)",
    )


class StartPaymentFromJobResponse(BaseModel):
    payment_id: str
    status: str

    job_id: int
    invoice_id: int
    amount: str
    currency: str

    idempotency_key: str