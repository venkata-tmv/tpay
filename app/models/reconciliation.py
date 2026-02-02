import enum
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import String, DateTime, Enum, Date, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReconciliationRunStatus(str, enum.Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ReconciliationItemStatus(str, enum.Enum):
    MATCHED = "matched"
    MISMATCH = "mismatch"
    MISSING = "missing"


class ReconciliationRun(Base):
    __tablename__ = "reconciliation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    report_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[ReconciliationRunStatus] = mapped_column(Enum(ReconciliationRunStatus), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReconciliationItem(Base):
    __tablename__ = "reconciliation_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("reconciliation_runs.id"), index=True, nullable=False)

    payment_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(String, nullable=True)

    expected_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    status: Mapped[ReconciliationItemStatus] = mapped_column(Enum(ReconciliationItemStatus), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
