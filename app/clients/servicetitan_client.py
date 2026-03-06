from __future__ import annotations
import time
import httpx
from typing import Any
from dataclasses import dataclass
from app.core.config import settings


class ServiceTitanAuthError(Exception):
    pass


class ServiceTitanAPIError(Exception):
    pass


@dataclass
class _TokenCache:
    access_token: str | None = None
    expires_at_epoch: float = 0.0


_token_cache = _TokenCache()


class ServiceTitanClient:
    """
    ServiceTitan API client:
    - OAuth2 token (client_credentials) from ST_TOKEN_URL
    - API calls to ST_API_BASE_URL with required headers (ST-App-Key, Authorization)
    """

    def __init__(self) -> None:
        self.api_base = settings.ST_API_BASE_URL.rstrip("/")
        self.token_url = settings.ST_TOKEN_URL
        self.app_key = settings.ST_APP_KEY
        self.client_id = settings.ST_CLIENT_ID
        self.client_secret = settings.ST_CLIENT_SECRET

    def _get_access_token(self) -> str:
        # Cached token with small safety window
        now = time.time()
        if _token_cache.access_token and now < (_token_cache.expires_at_epoch - 30):
            return _token_cache.access_token

        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        try:
            resp = httpx.post(self.token_url, data=data, headers=headers, timeout=20)
        except httpx.HTTPError as exc:
            raise ServiceTitanAuthError(f"Token request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAuthError(f"Token error {resp.status_code}: {resp.text}")

        payload = resp.json()
        token = payload.get("access_token")
        expires_in = payload.get("expires_in", 3600)

        if not token:
            raise ServiceTitanAuthError(f"Token missing access_token: {payload}")

        _token_cache.access_token = token
        _token_cache.expires_at_epoch = now + float(expires_in)
        return token

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._get_access_token()}",
            "ST-App-Key": self.app_key,
            "Accept": "application/json",
        }

    def get_jobs(self, *, tenant: str, params: dict[str, Any]) -> dict[str, Any]:
        """
        Calls:
        GET /jpm/v2/tenant/{tenant}/jobs
        """
        url = f"{self.api_base}/jpm/v2/tenant/{tenant}/jobs"

        try:
            resp = httpx.get(url, headers=self._headers(), params=params, timeout=30)
        except httpx.HTTPError as exc:
            raise ServiceTitanAPIError(f"ServiceTitan request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAPIError(f"ServiceTitan error {resp.status_code}: {resp.text}")

        return resp.json()
    
    def get_invoices(self, *, tenant: str, params: dict[str, Any]) -> dict[str, Any]:
        """
        Calls:
        GET /accounting/v2/tenant/{tenant}/invoices
        Useful params:
          - ids (comma-separated)
          - jobId
          - customerId
          - statuses
          - includeTotal, page, pageSize, etc.
        """
        url = f"{self.api_base}/accounting/v2/tenant/{tenant}/invoices"

        try:
            resp = httpx.get(url, headers=self._headers(), params=params, timeout=30)
        except httpx.HTTPError as exc:
            raise ServiceTitanAPIError(f"ServiceTitan request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAPIError(f"ServiceTitan error {resp.status_code}: {resp.text}")

        return resp.json()

    def get_customers(self, *, tenant: str, params: dict[str, Any]) -> dict[str, Any]:
        """
        Calls:
        GET /crm/v2/tenant/{tenant}/customers
        Useful params:
          - ids (comma-separated)
          - name, phone, city, state, active
          - page, pageSize, includeTotal
        """
        url = f"{self.api_base}/crm/v2/tenant/{tenant}/customers"

        try:
            resp = httpx.get(url, headers=self._headers(), params=params, timeout=30)
        except httpx.HTTPError as exc:
            raise ServiceTitanAPIError(f"ServiceTitan request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAPIError(f"ServiceTitan error {resp.status_code}: {resp.text}")

        return resp.json()
    
    def patch_invoice_custom_fields(
        self,
        *,
        tenant: str,
        operations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        PATCH /accounting/v2/tenant/{tenant}/invoices/custom-fields
        Body:
        {
          "operations": [
            {
              "objectId": <invoice_id>,
              "customFields": [{"name": "...", "value": "..."}]
            }
          ]
        }
        """
        url = f"{self.api_base}/accounting/v2/tenant/{tenant}/invoices/custom-fields"
        body = {"operations": operations}

        try:
            resp = httpx.patch(url, headers=self._headers(), json=body, timeout=30)
        except httpx.HTTPError as exc:
            raise ServiceTitanAPIError(f"ServiceTitan request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAPIError(f"ServiceTitan error {resp.status_code}: {resp.text}")

        return resp.json() if resp.text else {"ok": True}
    
    def get_job_by_id(self, *, tenant: str, job_id: int, externalDataApplicationGuid: str | None = None) -> dict[str, Any]:
        url = f"{self.api_base}/jpm/v2/tenant/{tenant}/jobs/{job_id}"
        params: dict[str, Any] = {}
        if externalDataApplicationGuid:
            params["externalDataApplicationGuid"] = externalDataApplicationGuid
        try:
            resp = httpx.get(url, headers=self._headers(), params=params, timeout=30)
        except httpx.HTTPError as exc:
            raise ServiceTitanAPIError(f"ServiceTitan request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAPIError(f"ServiceTitan error {resp.status_code}: {resp.text}")

        return resp.json()

    def get_employees(self, *, tenant: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.api_base}/settings/v2/tenant/{tenant}/employees"
        try:
            resp = httpx.get(url, headers=self._headers(), params=params, timeout=30)
        except httpx.HTTPError as exc:
            raise ServiceTitanAPIError(f"ServiceTitan request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAPIError(f"ServiceTitan error {resp.status_code}: {resp.text}")

        return resp.json()

    def get_technicians(self, *, tenant: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.api_base}/settings/v2/tenant/{tenant}/technicians"
        try:
            resp = httpx.get(url, headers=self._headers(), params=params, timeout=30)
        except httpx.HTTPError as exc:
            raise ServiceTitanAPIError(f"ServiceTitan request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAPIError(f"ServiceTitan error {resp.status_code}: {resp.text}")

        return resp.json()
    
    def create_payment(self, *, tenant: str, payload: dict[str, Any]) -> dict[str, Any]:
        """
        POST /accounting/v2/tenant/{tenant}/payments
        """
        url = f"{self.api_base}/accounting/v2/tenant/{tenant}/payments"
        try:
            resp = httpx.post(url, headers=self._headers(), json=payload, timeout=30)
        except httpx.HTTPError as exc:
            raise ServiceTitanAPIError(f"ServiceTitan request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise ServiceTitanAPIError(f"ServiceTitan error {resp.status_code}: {resp.text}")

        return resp.json()

    def list_payment_types(self, tenant: str) -> dict:
        url = f"{self.api_base}/accounting/v2/tenant/{tenant}/payment-types"
        resp = httpx.get(url, headers=self._headers(), timeout=30)
        resp.raise_for_status()
        return resp.json()