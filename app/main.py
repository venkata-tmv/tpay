from fastapi import FastAPI
from app.api.payments import router as payments_router
from app.api.payments.reconciliation import router as reconciliation_router
from app.api.tilled import router as tilled_router
from app.api.webhooks import router as webhooks_router
from app.api.webhook_events import router as webhook_events_router
from fastapi.middleware.cors import CORSMiddleware
from app.api.servicetitan import router as servicetitan_router

app = FastAPI(title="TPay", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(webhook_events_router, prefix="/webhooks", tags=["Webhooks"])
app.include_router(servicetitan_router, prefix="/servicetitan", tags=["ServiceTitan"])

@app.get("/health")
def health():
    return {"status": "ok"}
