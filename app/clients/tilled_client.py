from __future__ import annotations

from decimal import Decimal
import httpx

from app.core.config import settings


class TilledClient:
    def __init__(self) -> None:
        self.base_url = settings.TILLED_BASE_URL.rstrip("/")

    def _headers(self) -> dict[str, str]:
        # Auth as documented in Tilled API/Postman
        return {
            "tilled-account": settings.TILLED_ACCOUNT_ID,
            "tilled-api-key": settings.TILLED_SECRET_API_KEY,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _to_cents(amount: Decimal) -> int:
        # Payment Intent APIs usually take integer minor units (cents)
        # (Keep consistent; update if your Tilled account expects otherwise)
        return int((amount * Decimal("100")).quantize(Decimal("1")))

    def create_payment_intent(
        self,
        *,
        amount: Decimal,
        currency: str,
        confirm: bool = False,
        payment_method_id: str | None = None,
    ) -> dict:
        """
        Creates a Tilled Payment Intent.
        - For frontend-first flow: confirm=False and do NOT pass payment_method_id.
          You return client_secret to the frontend, which confirms via Payments.js.
        - For backend-only testing: confirm=True and pass payment_method_id.
        """
        url = f"{self.base_url}/v1/payment-intents"

        payload: dict = {
            "amount": self._to_cents(amount),
            "currency": currency.lower(),
            "payment_method_types": ["card"],
            "confirm": confirm,
        }

        if payment_method_id:
            payload["payment_method_id"] = payment_method_id

        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, headers=self._headers(), json=payload)

        if resp.status_code >= 400:
            try:
                err = resp.json()
            except Exception:
                err = {"raw": resp.text}
            raise RuntimeError(f"Tilled error {resp.status_code}: {err}")

        return resp.json()
