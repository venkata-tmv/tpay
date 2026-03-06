from __future__ import annotations

from dotenv import load_dotenv
from pathlib import Path
from dataclasses import dataclass
from functools import lru_cache
import os

# load project root .env
env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(env_path)

class MCPServiceTitanConfigError(Exception):
    pass


@dataclass(frozen=True)
class MCPServiceTitanSettings:
    tenant_id: str
    client_id: str
    client_secret: str
    app_key: str
    api_base_url: str
    token_url: str
    max_rows: int = 5000
    default_page_size: int = 200
    request_timeout_seconds: int = 30
    token_timeout_seconds: int = 20
    pii_redact_default: bool = True

    @property
    def normalized_api_base_url(self) -> str:
        return self.api_base_url.rstrip("/")

    @property
    def normalized_token_url(self) -> str:
        return self.token_url.rstrip("/")


def _get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise MCPServiceTitanConfigError(
            f"Missing required environment variable: {name}"
        )
    return value


def _get_optional_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise MCPServiceTitanConfigError(
            f"Environment variable {name} must be an integer, got: {raw}"
        ) from exc


def _get_optional_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default

    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    raise MCPServiceTitanConfigError(
        f"Environment variable {name} must be a boolean, got: {raw}"
    )


@lru_cache(maxsize=1)
def get_mcp_st_settings() -> MCPServiceTitanSettings:
    api_base_url = _get_required_env("MCP_ST_BASE_URL")

    # Token URL can be supplied explicitly via MCP_ST_TOKEN_URL.
    # If it is not provided, derive a default from MCP_ST_BASE_URL.
    token_url = os.getenv("MCP_ST_TOKEN_URL", "").strip()
    if not token_url:
        token_url = f"{api_base_url.rstrip('/')}/connect/token"

    return MCPServiceTitanSettings(
        tenant_id=_get_required_env("MCP_ST_TENANT_ID"),
        client_id=_get_required_env("MCP_ST_CLIENT_ID"),
        client_secret=_get_required_env("MCP_ST_CLIENT_SECRET"),
        app_key=_get_required_env("MCP_ST_APP_KEY"),
        api_base_url=api_base_url,
        token_url=token_url,
        max_rows=_get_optional_int("MCP_ST_MAX_ROWS", 5000),
        default_page_size=_get_optional_int("MCP_ST_DEFAULT_PAGE_SIZE", 200),
        request_timeout_seconds=_get_optional_int("MCP_ST_REQUEST_TIMEOUT_SECONDS", 30),
        token_timeout_seconds=_get_optional_int("MCP_ST_TOKEN_TIMEOUT_SECONDS", 20),
        pii_redact_default=_get_optional_bool("MCP_ST_PII_REDACT_DEFAULT", True),
    )