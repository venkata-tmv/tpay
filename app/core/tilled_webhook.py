from __future__ import annotations

import hmac
import hashlib
import time


class WebhookSignatureError(Exception):
    pass


def _parse_payments_signature(header_value: str, scheme: str = "v1") -> tuple[int, str]:
    """
    Header format (per Tilled docs):
    payments-signature: "t=1614049713663,v1=<hex>"
    Timestamp is UTC millis.
    """
    if not isinstance(header_value, str) or not header_value:
        raise WebhookSignatureError("Missing payments-signature header")

    timestamp = None
    sig = None

    parts = header_value.split(",")
    for item in parts:
        kv = item.split("=", 1)
        if len(kv) != 2:
            continue
        k, v = kv[0].strip(), kv[1].strip()
        if k == "t":
            try:
                timestamp = int(v)
            except ValueError:
                raise WebhookSignatureError("Invalid timestamp in payments-signature")
        if k == scheme:
            sig = v

    if timestamp is None or sig is None:
        raise WebhookSignatureError("Unable to extract timestamp and v1 signature")

    return timestamp, sig


def verify_tilled_signature(
    *,
    header_value: str | None,
    raw_body: bytes,
    secret: str,
    tolerance_seconds: int = 300,
) -> None:
    """
    Per Tilled docs, signed payload is:
      "<timestamp>.<raw_json_body>"
    HMAC SHA256 using endpoint secret key, hex digest, compare with v1 signature. :contentReference[oaicite:2]{index=2}
    """
    if header_value is None:
        raise WebhookSignatureError("Missing payments-signature header")

    timestamp_ms, received_sig = _parse_payments_signature(header_value, "v1")

    # Validate timestamp freshness
    now_ms = int(time.time() * 1000)
    if abs(now_ms - timestamp_ms) > tolerance_seconds * 1000:
        raise WebhookSignatureError("Webhook timestamp outside tolerance window")

    signed_payload = str(timestamp_ms) + "." + raw_body.decode("utf-8")

    expected_sig = hmac.new(
        key=secret.encode("utf-8"),
        msg=signed_payload.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, received_sig):
        raise WebhookSignatureError("Webhook signature mismatch")
