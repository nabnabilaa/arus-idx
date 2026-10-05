"""Vercel serverless webhook for @nab_arus_bot: Telegram POSTs each update here."""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from arus.agent import env, handle_update  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        cfg = env()
        secret = cfg.get("TELEGRAM_WEBHOOK_SECRET")
        if secret and self.headers.get("X-Telegram-Bot-Api-Secret-Token") != secret:
            self.send_response(401)
            self.end_headers()
            return
        size = int(self.headers.get("content-length") or 0)
        try:
            handle_update(json.loads(self.rfile.read(size) or b"{}"), cfg["TELEGRAM_BOT_TOKEN"])
        except Exception as e:  # always answer 200 so Telegram doesn't retry a bad update forever
            print(f"[webhook] error: {e!r}", flush=True)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("Arus Telegram webhook is running.".encode())
