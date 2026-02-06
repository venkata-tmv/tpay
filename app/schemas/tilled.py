from pydantic import BaseModel


class TilledConfigResponse(BaseModel):
    publishable_key: str
    account_id: str
    sandbox: bool
