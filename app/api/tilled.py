from fastapi import APIRouter

from app.core.config import settings
from app.schemas.tilled import TilledConfigResponse

router = APIRouter()


@router.get("/config", response_model=TilledConfigResponse)
def tilled_config():
    return TilledConfigResponse(
        publishable_key=settings.TILLED_PUBLISHABLE_KEY,
        account_id=settings.TILLED_ACCOUNT_ID,
        sandbox=settings.TILLED_SANDBOX,
    )
