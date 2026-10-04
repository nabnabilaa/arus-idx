"""
Sectors API client with a permanent response cache and a credit meter.

Every credit is paid at most once: responses (2xx and 404, both billed) are stored in
SQLite keyed by (path, sorted params) and served from there forever after. A dry-run mode
counts what a cache miss *would* cost without firing, and a hard cap stops a runaway loop.
"""

import json
import math
import sqlite3
import time
from dataclasses import dataclass, field
from urllib.parse import urlencode

import requests

from arus import config

_SCHEMA = """
CREATE TABLE IF NOT EXISTS responses (
    key        TEXT PRIMARY KEY,
    path       TEXT NOT NULL,
    params     TEXT NOT NULL,
    status     INTEGER NOT NULL,
    body       TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      TEXT NOT NULL,
    path    TEXT NOT NULL,
    params  TEXT NOT NULL,
    status  INTEGER NOT NULL,
    credits REAL NOT NULL
);
"""


class CreditCapReached(RuntimeError):
    pass


class ApiError(RuntimeError):
    def __init__(self, status: int, path: str, body: str):
        super().__init__(f"HTTP {status} on {path}: {body[:300]}")
        self.status = status


def _cache_key(path: str, params: dict) -> str:
    clean = {k: v for k, v in sorted(params.items()) if v is not None}
    return path + "?" + urlencode(clean)


def estimate_credits(path: str, params: dict, body=None) -> float:
    """Credit cost per the Sectors billing rules."""
    if path.startswith("/v2/companies/") and path.rstrip("/") == "/v2/companies":
        if params.get("q"):
            return 3
        if body and isinstance(body, dict) and "results" in body:
            return max(1, math.ceil(len(body["results"]) / 100))
        return max(1, math.ceil(int(params.get("limit", 100)) / 100))
    if path.rstrip("/") == "/v2/free-float":
        if body and isinstance(body, list):
            return max(1, math.ceil(len(body) / 100))
        return 10
    if "/report/" in path:
        sections = params.get("sections")
        return len(sections.split(",")) if sections else 8
    if path.rstrip("/").endswith("/top") and (
            path.startswith("/v2/broker-summary/") or path.startswith("/v2/broker-activity/")
            or path.startswith("/v2/brokers/")):
        return 2
    if path.rstrip("/") == "/v2/most-traded":
        return 2
    return 1


@dataclass
class SectorsClient:
    dry_run: bool = False
    credit_cap: float = 400.0
    spent: float = 0.0
    would_spend: float = 0.0
    calls: int = 0
    cache_hits: int = 0
    min_interval: float = 1.1          # seconds between live calls (rate limit ≈ 60/min)
    _last_call: float = 0.0
    _conn: sqlite3.Connection = field(default=None, repr=False)

    def __post_init__(self):
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(config.CACHE_DB)
        self._conn.executescript(_SCHEMA)
        self._session = requests.Session()

    # ------------------------------------------------------------------
    def get(self, path: str, params: dict | None = None, *, refresh: bool = False):
        """GET a Sectors endpoint. Returns parsed JSON, or None for 404 / dry-run misses."""
        params = {k: v for k, v in (params or {}).items() if v is not None}
        key = _cache_key(path, params)

        if not refresh:
            row = self._conn.execute(
                "SELECT status, body FROM responses WHERE key=?", (key,)).fetchone()
            if row:
                self.cache_hits += 1
                return json.loads(row[1]) if row[0] == 200 else None

        cost = estimate_credits(path, params)
        if self.dry_run:
            self.would_spend += cost
            return None
        if self.spent + cost > self.credit_cap:
            raise CreditCapReached(
                f"cap {self.credit_cap} would be exceeded (spent {self.spent:.0f}, next {cost})")

        token = config.api_key()
        if not token:
            raise RuntimeError("SECTORS_API_KEY missing — put it in .env")

        resp = None
        for attempt in range(8):
            wait = self.min_interval - (time.monotonic() - self._last_call)
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.monotonic()
            try:
                resp = self._session.get(config.API_BASE + path, params=params,
                                         headers={"Authorization": token}, timeout=60)
            except requests.RequestException:
                time.sleep(2 ** attempt)
                continue
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                try:
                    pause = float(retry_after)
                except (TypeError, ValueError):
                    pause = 15.0 * (attempt + 1)
                time.sleep(min(pause, 120))
                continue
            if resp.status_code >= 500:
                time.sleep(2 ** attempt + 1)
                continue
            break
        if resp is None:
            raise RuntimeError(f"network failure on {path}")

        self.calls += 1
        status = resp.status_code
        billed = status == 200 or status == 404
        body_text = resp.text
        body = None
        if status == 200:
            body = resp.json()
            cost = estimate_credits(path, params, body)
        if billed:
            self.spent += cost
            now = time.strftime("%Y-%m-%d %H:%M:%S")
            self._conn.execute(
                "INSERT INTO ledger (ts, path, params, status, credits) VALUES (?,?,?,?,?)",
                (now, path, json.dumps(params), status, cost))
            self._conn.execute(
                "INSERT OR REPLACE INTO responses VALUES (?,?,?,?,?,?)",
                (key, path, json.dumps(params), status, body_text, now))
            self._conn.commit()
        if status == 200:
            return body
        if status == 404:
            return None
        raise ApiError(status, path, body_text)

    # ------------------------------------------------------------------
    def lifetime_spent(self) -> float:
        row = self._conn.execute("SELECT COALESCE(SUM(credits),0) FROM ledger").fetchone()
        return float(row[0])

    def summary(self) -> str:
        mode = f"dry-run, would spend {self.would_spend:.0f}" if self.dry_run \
            else f"spent {self.spent:.0f}"
        return (f"[client] {mode} · {self.calls} live calls · {self.cache_hits} cache hits · "
                f"lifetime ledger {self.lifetime_spent():.0f} credits")
