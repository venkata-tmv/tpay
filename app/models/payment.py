import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    String,
    DateTime,
    Enum,
    Numeric,
    Boolean,
    Integer
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PaymentStatus(str, enum.Enum):
    INITIATED = "initiated"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True
    )

    job_id: Mapped[str] = mapped_column(
        String, index=True, nullable=False
    )
    invoice_id: Mapped[str] = mapped_column(
        String, index=True, nullable=False
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(3), default="USD"
    )

    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), nullable=False
    )

    idempotency_key: Mapped[str] = mapped_column(
        String, unique=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    provider: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    provider_payment_id: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    failure_reason: Mapped[str | None] = mapped_column(
        String, nullable=True
    )
    execute_idempotency_key: Mapped[str | None] = mapped_column(
        String, unique=True, nullable=True
    )

    retry_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )

    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    st_payment_id: Mapped[str | None] = mapped_column(String, nullable=True)
    st_writeback_status: Mapped[str | None] = mapped_column(String, nullable=True)  # "pending"|"succeeded"|"failed"
    st_writeback_error: Mapped[str | None] = mapped_column(String, nullable=True)
    st_written_back_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # snapshot what we charged & why (helps audit + recon)
    amount_source: Mapped[str | None] = mapped_column(String, nullable=True)  # "balance"|"total"|"manual"
    st_invoice_total: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    st_invoice_balance: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)