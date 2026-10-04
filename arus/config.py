"""Paths and secrets. The API key is read from .env or the environment, never from code."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SNAPSHOT_DIR = ROOT / "snapshot"
CACHE_DB = DATA_DIR / "cache.db"
WAREHOUSE_DB = DATA_DIR / "warehouse.db"

API_BASE = "https://api.sectors.app"


def _read_dotenv() -> dict:
    env = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def api_key() -> str | None:
    key = os.environ.get("SECTORS_API_KEY") or _read_dotenv().get("SECTORS_API_KEY")
    if key and key != "your_key_here":
        return key
    try:
        import streamlit as st
        return st.secrets.get("SECTORS_API_KEY")
    except Exception:
        return None
