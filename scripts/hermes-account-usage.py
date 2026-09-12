"""Read OpenAI Codex subscription quota without starting a Codex turn.

Hermes is used only as the credential resolver/refresh owner. The quota request itself
goes straight to the Codex usage endpoint and this process emits only a small sanitized
JSON object. It never prints, stores, or returns OAuth credentials or provider errors.
"""

from __future__ import annotations

import json
import math
import sys
import time
from typing import Any


DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"


def _is_num(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
    )


def _millis(value: Any) -> int | None:
    if not _is_num(value):
        return None
    numeric = float(value)
    if numeric <= 0:
        return None
    # Codex currently returns Unix seconds; accepting milliseconds makes the bridge
    # tolerant of a future response shape without changing the daemon contract.
    return int(numeric if numeric > 10_000_000_000 else numeric * 1000)


def _usage_url(base_url: Any) -> str:
    normalized = str(base_url or "").strip().rstrip("/") or DEFAULT_CODEX_BASE_URL
    if normalized.endswith("/codex"):
        normalized = normalized[: -len("/codex")]
    prefix = normalized + ("/wham" if "/backend-api" in normalized else "/api/codex")
    return prefix + "/usage"


def _account_id(token: str) -> str | None:
    # The header is required for some account shapes but is optional for others. Prefer
    # the account claim in the exact token being used; this also works for pool entries.
    try:
        from hermes_cli.auth_constants import _decode_jwt_claims

        auth_claims = _decode_jwt_claims(token).get("https://api.openai.com/auth")
        value = auth_claims.get("chatgpt_account_id") if isinstance(auth_claims, dict) else None
        if isinstance(value, str) and value.strip():
            return value.strip()
    except Exception:
        pass

    # Older Hermes stores may carry the account id beside the token. Do not use that
    # fallback when the resolver selected a different pool token/account.
    try:
        from hermes_cli.auth import _read_codex_tokens

        tokens = (_read_codex_tokens().get("tokens") or {})
        if tokens.get("access_token") != token:
            return None
        value = tokens.get("account_id")
        return value.strip() if isinstance(value, str) and value.strip() else None
    except Exception:
        return None


def _read_provider_usage() -> dict[str, Any]:
    import httpx
    from hermes_cli.auth import resolve_codex_runtime_credentials

    runtime = resolve_codex_runtime_credentials(refresh_if_expiring=True)
    token = str(runtime.get("api_key") or "").strip()
    if not token:
        return {"available": False, "reason": "missing-credential"}

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "codex-cli",
    }
    account_id = _account_id(token)
    if account_id:
        headers["ChatGPT-Account-Id"] = account_id

    with httpx.Client(timeout=15.0, follow_redirects=False) as client:
        response = client.get(_usage_url(runtime.get("base_url")), headers=headers)
        response.raise_for_status()
        payload = response.json() or {}

    rate_limit = payload.get("rate_limit") or {}
    windows: list[dict[str, Any]] = []
    for provider_key, window_kind in (
        ("primary_window", "5h"),
        ("secondary_window", "weekly"),
    ):
        window = rate_limit.get(provider_key) or {}
        used = window.get("used_percent")
        if not _is_num(used):
            continue
        windows.append(
            {
                "windowKind": window_kind,
                "usedPercent": float(used),
                "resetAt": _millis(window.get("reset_at")),
            }
        )

    return {
        "available": bool(windows),
        "fetchedAt": int(time.time() * 1000),
        "windows": windows,
    }


def main() -> int:
    try:
        print(json.dumps(_read_provider_usage(), separators=(",", ":")))
    except Exception:
        # Quota is supplementary. Fail closed without exposing a provider or auth
        # error (some provider errors echo request details).
        print(json.dumps({"available": False, "reason": "unavailable"}, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
