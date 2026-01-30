import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    String,
    DateTime,
    Enum,
    Numeric,
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
