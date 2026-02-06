from fastapi import APIRouter

from app.api.payments.intents import router as intents_router
from app.api.payments.execution import router as execution_router
from app.api.payments.provider_intent import router as provider_intent_router
router = APIRouter()

router.include_router(intents_router)
router.include_router(execution_router)
router.include_router(provider_intent_router)
