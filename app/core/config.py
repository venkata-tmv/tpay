from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Tilled
    TILLED_BASE_URL: str = "https://sandbox-api.tilled.com"
    TILLED_ACCOUNT_ID: str  # acct_...
    TILLED_SECRET_API_KEY: str  # tilled-api-key (server secret)
    TILLED_PUBLISHABLE_KEY: str  # pk_... (frontend safe)
    TILLED_SANDBOX: bool = True
    # Webhooks
    TILLED_WEBHOOK_SECRET: str
    TILLED_WEBHOOK_TOLERANCE_SECONDS: int = 300



settings = Settings()
