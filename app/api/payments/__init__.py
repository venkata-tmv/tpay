from fastapi import APIRouter

from app.api.payments.intents import router as intents_router
from app.api.payments.execution import router as execution_router
# from app.api.payments.reconciliation import router as reconciliation_router
router = APIRouter()

router.include_router(intents_router)
router.include_router(execution_router)
# router.include_router(reconciliation_router)
