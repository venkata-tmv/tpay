import hmac
import hashlib
import time


class WebhookSignatureError(Exception):
    pass


def verify_tilled_signature(
    *,
    header_value: str | None,
    raw_body: bytes,
    secret: str,
    tolerance_seconds: int = 300,
) -> None:
    if not header_value:
        raise WebhookSignatureError("Missing tilled-signature header")

    # header: "t=...,v1=..."
    parts = {}
    for item in header_value.split(","):
        if "=" in item:
            k, v = item.split("=", 1)
            parts[k.strip()] = v.strip()

    ts = parts.get("t")
    sig = parts.get("v1")
    if not ts or not sig:
        raise WebhookSignatureError("Invalid tilled-signature format")

    try:
        ts_int = int(ts)
    except ValueError:
        raise WebhookSignatureError("Invalid timestamp in signature")

    # Tilled timestamp appears to be milliseconds
    now_ms = int(time.time() * 1000)
    if abs(now_ms - ts_int) > tolerance_seconds * 1000:
        raise WebhookSignatureError("Signature timestamp outside tolerance")

    signed_payload = ts.encode("utf-8") + b"." + raw_body
    expected = hmac.new(
        key=secret.encode("utf-8"),
        msg=signed_payload,
        digestmod=hashlib.sha256,
    ).hexdigest()


    if not hmac.compare_digest(expected, sig):
        raise WebhookSignatureError("Signature verification failed")
