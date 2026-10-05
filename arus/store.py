"""
Where the Telegram bot keeps each chat's language, filters and watchlist.

Locally (and for the daily digest on the developer machine) that is a SQLite file. On Vercel, where
functions have no persistent disk, it is Upstash Redis over its REST API — picked automatically when
`KV_REST_API_URL`/`KV_REST_API_TOKEN` (Vercel's Upstash integration) or `UPSTASH_REDIS_REST_URL`/
`UPSTASH_REDIS_REST_TOKEN` are set. Both expose the same small interface.
"""

import json
import os
import sqlite3

import requests

DEFAULT = {"lang": "id", "sharia": False, "max_price": None}


class SqliteStore:
    def __init__(self, path):
        path.parent.mkdir(exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.executescript("""CREATE TABLE IF NOT EXISTS chats (chat_id INTEGER PRIMARY KEY, lang TEXT DEFAULT 'id');
                                 CREATE TABLE IF NOT EXISTS watch (chat_id INTEGER, symbol TEXT, PRIMARY KEY (chat_id, symbol));""")
        for col in ("sharia INTEGER DEFAULT 0", "max_price REAL"):
            try:
                self.db.execute(f"ALTER TABLE chats ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass

    def chats(self) -> list[int]:
        return [r[0] for r in self.db.execute("SELECT chat_id FROM chats")]

    def prefs(self, chat_id: int) -> dict:
        row = self.db.execute("SELECT lang, sharia, max_price FROM chats WHERE chat_id=?", (chat_id,)).fetchone()
        return {"lang": row[0] or "id", "sharia": bool(row[1]), "max_price": row[2]} if row else dict(DEFAULT)

    def set(self, chat_id: int, **fields):
        self.db.execute("INSERT OR IGNORE INTO chats (chat_id) VALUES (?)", (chat_id,))
        for k, v in fields.items():
            self.db.execute(f"UPDATE chats SET {k}=? WHERE chat_id=?", (int(v) if isinstance(v, bool) else v, chat_id))
        self.db.commit()

    def watch(self, chat_id: int) -> list[str]:
        return [r[0] for r in self.db.execute("SELECT symbol FROM watch WHERE chat_id=? ORDER BY rowid", (chat_id,))]

    def add_watch(self, chat_id: int, symbol: str):
        self.set(chat_id)
        self.db.execute("INSERT OR IGNORE INTO watch VALUES (?, ?)", (chat_id, symbol))
        self.db.commit()

    def remove_watch(self, chat_id: int, symbol: str):
        self.db.execute("DELETE FROM watch WHERE chat_id=? AND symbol=?", (chat_id, symbol))
        self.db.commit()


class RedisStore:
    """Upstash Redis REST: a hash per chat, a list per watchlist, a set of all chats."""

    def __init__(self, url: str, token: str):
        self.url, self.h = url.rstrip("/"), {"Authorization": f"Bearer {token}"}

    def _cmd(self, *args):
        r = requests.post(self.url, headers=self.h, json=[str(a) for a in args], timeout=10)
        r.raise_for_status()
        return r.json().get("result")

    def chats(self) -> list[int]:
        return [int(x) for x in (self._cmd("SMEMBERS", "arus:chats") or [])]

    def prefs(self, chat_id: int) -> dict:
        raw = self._cmd("GET", f"arus:chat:{chat_id}")
        return {**DEFAULT, **json.loads(raw)} if raw else dict(DEFAULT)

    def set(self, chat_id: int, **fields):
        p = self.prefs(chat_id)
        p.update(fields)
        self._cmd("SET", f"arus:chat:{chat_id}", json.dumps(p))
        self._cmd("SADD", "arus:chats", chat_id)

    def watch(self, chat_id: int) -> list[str]:
        return self._cmd("LRANGE", f"arus:watch:{chat_id}", 0, -1) or []

    def add_watch(self, chat_id: int, symbol: str):
        self.set(chat_id)
        if symbol not in self.watch(chat_id):
            self._cmd("RPUSH", f"arus:watch:{chat_id}", symbol)

    def remove_watch(self, chat_id: int, symbol: str):
        self._cmd("LREM", f"arus:watch:{chat_id}", 0, symbol)


def open_store(env: dict, local_path):
    url = env.get("KV_REST_API_URL") or env.get("UPSTASH_REDIS_REST_URL") or os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
    token = env.get("KV_REST_API_TOKEN") or env.get("UPSTASH_REDIS_REST_TOKEN") or os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    return RedisStore(url, token) if url and token else SqliteStore(local_path)
