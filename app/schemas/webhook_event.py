from datetime import datetime
from pydantic import BaseModel


class WebhookEventResponse(BaseModel):
    id: str
    provider: str
    provider_event_id: str
    event_type: str
    account_id: str | None
    payment_id: str | None
    received_at: datetime
    processed_at: datetime | None
    processing_error: str | None
    payload: dict


class WebhookEventListResponse(BaseModel):
    items: list[WebhookEventResponse]
    total: int
