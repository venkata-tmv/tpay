from pydantic import BaseModel


class ProviderIntentCreateRequest(BaseModel):
    # optional for backend-only testing; frontend won’t send card details to backend
    payment_method_id: str | None = None
    confirm: bool = False


class ProviderIntentResponse(BaseModel):
    payment_id: str
    provider_payment_intent_id: str
    client_secret: str | None = None
    provider_status: str | None = None
