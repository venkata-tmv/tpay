from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.webhook_event import WebhookEvent
from app.schemas.webhook_event import WebhookEventResponse, WebhookEventListResponse

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _to_response(e: WebhookEvent) -> WebhookEventResponse:
    return WebhookEventResponse(
        id=e.id,
        provider=e.provider,
        provider_event_id=e.provider_event_id,
        event_type=e.event_type,
        account_id=e.account_id,
        payment_id=e.payment_id,
        received_at=e.received_at,
        processed_at=e.processed_at,
        processing_error=e.processing_error,
        payload=e.payload,
    )


@router.get("/events/{provider_event_id}", response_model=WebhookEventResponse)
def get_webhook_event(provider_event_id: str, db: Session = Depends(get_db)):
    e = (
        db.query(WebhookEvent)
        .filter(WebhookEvent.provider_event_id == provider_event_id)
        .one_or_none()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Webhook event not found")
    return _to_response(e)


@router.get("/events", response_model=WebhookEventListResponse)
def list_webhook_events(
    payment_id: str | None = Query(default=None),
    provider_event_id: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(WebhookEvent)

    if provider:
        q = q.filter(WebhookEvent.provider == provider)

    if payment_id:
        q = q.filter(WebhookEvent.payment_id == payment_id)

    if provider_event_id:
        q = q.filter(WebhookEvent.provider_event_id == provider_event_id)

    if event_type:
        q = q.filter(WebhookEvent.event_type == event_type)

    total = q.count()
    items = (
        q.order_by(WebhookEvent.received_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return WebhookEventListResponse(
        items=[_to_response(e) for e in items],
        total=total,
    )
