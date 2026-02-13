from __future__ import annotations

from decimal import Decimal
import httpx

from app.core.config import settings


class TilledClient:
    def __init__(self) -> None:
        self.base_url = settings.TILLED_BASE_URL.rstrip("/")

    def _headers(self) -> dict[str, str]:
        # Keep what you already used successfully in your project
        return {
            "tilled-account": settings.TILLED_ACCOUNT_ID,
            "tilled-api-key": settings.TILLED_SECRET_API_KEY,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _to_cents(amount: Decimal) -> int:
        return int((amount * Decimal("100")).quantize(Decimal("1")))

    @staticmethod
    def _from_cents(amount_cents: int | None) -> Decimal | None:
        if amount_cents is None:
            return None
        return (Decimal(amount_cents) / Decimal("100")).quantize(Decimal("0.01"))

    def create_payment_intent(
        self,
        *,
        amount: Decimal,
        currency: str,
        confirm: bool = False,
        payment_method_id: str | None = None,
    ) -> dict:
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

    def get_payment_intent(self, provider_payment_intent_id: str) -> dict:
        """
        Fetch a Tilled Payment Intent (pi_...) by id.
        Used by reconciliation to verify internal vs provider truth.
        """
        url = f"{self.base_url}/v1/payment-intents/{provider_payment_intent_id}"

        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, headers=self._headers())

        if resp.status_code == 404:
            raise RuntimeError("Tilled payment_intent not found")

        if resp.status_code >= 400:
            try:
                err = resp.json()
            except Exception:
                err = {"raw": resp.text}
            raise RuntimeError(f"Tilled error {resp.status_code}: {err}")

        return resp.json()
