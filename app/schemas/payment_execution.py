from pydantic import BaseModel


class PaymentExecuteResponse(BaseModel):
    payment_id: str
    status: str
