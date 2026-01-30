from fastapi import FastAPI
# from app.api.payments import router as payments_router

app = FastAPI(
    title="TPay",
    version="1.0.0"
)

# app.include_router(payments_router, prefix="/payments", tags=["Payments"])

@app.get("/health")
def health():
    return {"status": "ok"}
