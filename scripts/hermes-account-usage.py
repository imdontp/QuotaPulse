"""Emit only sanitized OpenAI Codex account quota data for QuotaPulse.

This script is intentionally executed by Hermes' own virtualenv. Hermes owns the
OAuth token lifecycle and this process never prints, stores, or returns credentials.
The Node daemon consumes the small JSON object written to stdout.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime


def _millis(value: datetime | None) -> int | None:
    if value is None:
        return None
    return int(value.timestamp() * 1000)


def main() -> int:
    try:
        from agent.account_usage import fetch_account_usage

        snapshot = fetch_account_usage("openai-codex")
        if snapshot is None:
            print(json.dumps({"available": False}, separators=(",", ":")))
            return 0

        print(
            json.dumps(
                {
                    "available": bool(snapshot.windows),
                    "fetchedAt": _millis(snapshot.fetched_at),
                    "plan": snapshot.plan,
                    "windows": [
                        {
                            "label": window.label,
                            "usedPercent": window.used_percent,
                            "resetAt": _millis(window.reset_at),
                        }
                        for window in snapshot.windows
                    ],
                },
                separators=(",", ":"),
            )
        )
        return 0
    except Exception:
        # Quota is supplementary. Fail closed without exposing a provider or auth
        # error (some provider errors echo request details).
        print(json.dumps({"available": False}, separators=(",", ":")))
        return 0


if __name__ == "__main__":
    sys.exit(main())
