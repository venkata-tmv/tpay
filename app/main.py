from fastapi import FastAPI
from app.api.payments import router as payments_router
from app.api.payments.reconciliation import router as reconciliation_router
from app.api.tilled import router as tilled_router
from app.api.webhooks import router as webhooks_router

app = FastAPI(title="TPay", version="1.0.0")

app.include_router(
    payments_router,
    prefix="/payments",
    tags=["Payments"]
)
app.include_router(
    reconciliation_router,
    prefix="/reconciliation",
    tags=["Reconciliation"]
)
app.include_router(tilled_router, prefix="/tilled", tags=["Tilled"])
app.include_router(webhooks_router, prefix="/webhooks", tags=["Webhooks"])

@app.get("/health")
def health():
    return {"status": "ok"}
