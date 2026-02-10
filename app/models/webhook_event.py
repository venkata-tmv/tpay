import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "tilled"
    provider_event_id: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    event_type: Mapped[str] = mapped_column(String(200), nullable=False)

    # helpful context (often present in webhook payload)
    account_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # link to our internal payment if we can resolve it
    payment_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)


Index("ix_webhook_events_provider_event_type", WebhookEvent.provider, WebhookEvent.event_type)
