"""
Arus agent — the daily loop that keeps Arus alive without anyone opening the website.

    python -m arus.agent daily            # refresh data → retrain → grade yesterday → Telegram digest
    python -m arus.agent daily --dry-run  # estimate credits only
    python -m arus.agent digest           # (re)send today's digest from the current snapshot
    python -m arus.agent bot              # interactive Telegram bot (reads the snapshot, 0 credits)

Every day the agent also grades itself: yesterday's next-day verdicts are checked against
what actually happened, and the running record is written to snapshot/track.json — a live
track record nobody can retrofit.

Telegram: create a bot with @BotFather, put TELEGRAM_BOT_TOKEN (and optionally
TELEGRAM_CHAT_ID for the daily broadcast) in .env. Anyone who sends /start to the bot is
subscribed to the daily digest.
"""

import argparse
import json
import sqlite3
import sys
import time
from datetime import date, datetime, timedelta

import requests

from arus import config
from arus.client import SectorsClient

SNAP = config.SNAPSHOT_DIR
HIST = SNAP / "history"
TRACK = SNAP / "track.json"
BOT_DB = config.DATA_DIR / "telegram.db"

VERDICT = {"strong": "Sangat diunggulkan", "edge": "Diunggulkan", "neutral": "Netral",
           "weak": "Kurang diunggulkan", "caution": "Waspada"}
VERDICT_EN = {"strong": "Strong edge", "edge": "Edge", "neutral": "Neutral", "weak": "Weak", "caution": "Caution"}


def verdict_of(q: float | None) -> str:
    q = 0.5 if q is None else q
    return "strong" if q >= 0.9 else "edge" if q >= 0.7 else "neutral" if q > 0.3 else "weak" if q > 0.1 else "caution"


def env() -> dict:
    out = {}
    p = config.ROOT / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def load_bundle() -> dict:
    return json.loads((SNAP / "arus.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# self-grading: did yesterday's next-day verdicts come true?
# ---------------------------------------------------------------------------
def save_picks(bundle: dict):
    """Freeze today's verdicts so tomorrow's run can grade them."""
    HIST.mkdir(parents=True, exist_ok=True)
    picks = {"as_of": bundle["meta"]["as_of"], "stocks": {}}
    for s in bundle["ranking"]:
        picks["stocks"][s["symbol"]] = {"q_1": s.get("q_1"), "q_20": s.get("q_20"), "price": s.get("price")}
    (HIST / f"{bundle['meta']['as_of']}.json").write_text(json.dumps(picks), encoding="utf-8")


def grade(bundle: dict) -> dict | None:
    """Grade the most recent frozen picks older than today against today's closes."""
    today = bundle["meta"]["as_of"]
    prev = sorted(p for p in HIST.glob("*.json") if p.stem < today) if HIST.exists() else []
    if not prev:
        return None
    picks = json.loads(prev[-1].read_text(encoding="utf-8"))
    now = {s["symbol"]: s.get("price") for s in bundle["ranking"]}
    rets = {}
    for sym, p in picks["stocks"].items():
        if p.get("price") and now.get(sym):
            rets[sym] = now[sym] / p["price"] - 1
    if len(rets) < 20:
        return None
    med = sorted(rets.values())[len(rets) // 2]
    groups = {}
    for sym, r in rets.items():
        v = verdict_of(picks["stocks"][sym].get("q_1"))
        g = groups.setdefault(v, {"n": 0, "won": 0, "ret": 0.0})
        g["n"] += 1
        g["won"] += int(r > med)
        g["ret"] += r
    for g in groups.values():
        g["ret"] /= max(g["n"], 1)
    entry = {"picked_on": picks["as_of"], "graded_on": today, "groups": groups}

    track = json.loads(TRACK.read_text(encoding="utf-8")) if TRACK.exists() else {"days": []}
    track["days"] = [d for d in track["days"] if d["picked_on"] != entry["picked_on"]] + [entry]
    tot = {}
    for d in track["days"]:
        for v, g in d["groups"].items():
            t = tot.setdefault(v, {"n": 0, "won": 0})
            t["n"] += g["n"]
            t["won"] += g["won"]
    track["totals"] = tot
    TRACK.write_text(json.dumps(track, indent=1), encoding="utf-8")
    web = config.ROOT / "web" / "src" / "data" / "track.json"
    web.write_text(json.dumps(track), encoding="utf-8")
    return entry


# ---------------------------------------------------------------------------
# digest
# ---------------------------------------------------------------------------
def _pct(x):
    return f"{x * 100:+.1f}%" if x is not None else "–"


def digest_text(bundle: dict, graded: dict | None, watch: list[str] | None = None, lang: str = "id") -> str:
    V = VERDICT if lang == "id" else VERDICT_EN
    rk = bundle["ranking"]
    by = {s["symbol"]: s for s in rk}
    d = bundle["meta"]["as_of"]
    L = []
    L.append(f"🌊 <b>Arus · {d}</b>")
    mk = [m for m in bundle["market"] if m.get("ihsg")]
    if len(mk) > 21:
        ch1 = mk[-1]["ihsg"] / mk[-2]["ihsg"] - 1
        ch20 = mk[-1]["ihsg"] / mk[-21]["ihsg"] - 1
        ff = sum((m.get("foreign_net") or 0) for m in bundle["market"][-20:])
        if lang == "id":
            L.append(f"IHSG {mk[-1]['ihsg']:,.0f} ({_pct(ch1)} hari ini, {_pct(ch20)} sebulan) · asing {'beli' if ff >= 0 else 'jual'} Rp{abs(ff) / 1e12:.1f} T sebulan")
        else:
            L.append(f"IHSG {mk[-1]['ihsg']:,.0f} ({_pct(ch1)} today, {_pct(ch20)} 1M) · foreigners net {'bought' if ff >= 0 else 'sold'} IDR {abs(ff) / 1e12:.1f}T 1M")

    if graded:
        g = graded["groups"]
        parts = []
        for v in ("strong", "caution"):
            if v in g and g[v]["n"]:
                hit = g[v]["won"] if v == "strong" else g[v]["n"] - g[v]["won"]
                parts.append(f"{V[v]}: {hit}/{g[v]['n']} {'tepat' if lang == 'id' else 'correct'}")
        if parts:
            L.append("")
            L.append(("📋 <b>Rapor kemarin</b> (" if lang == "id" else "📋 <b>Yesterday's report card</b> (") + graded["picked_on"] + "): " + " · ".join(parts))

    for h, title_id, title_en in ((1, "Besok", "Next day"), (20, "1 bulan", "1 month")):
        top = sorted(rk, key=lambda s: -(s.get(f"conf_{h}") or 0))[:5]
        bot = sorted(rk, key=lambda s: (s.get(f"conf_{h}") or 0))[:5]
        L.append("")
        L.append(f"<b>{title_id if lang == 'id' else title_en}</b>")
        L.append(("🔵 " + V["strong"] + ": ") + ", ".join(f"{s['symbol']} {round((s.get(f'conf_{h}') or 0.5) * 100)}" for s in top))
        L.append(("🔴 " + V["caution"] + ": ") + ", ".join(f"{s['symbol']} {round((s.get(f'conf_{h}') or 0.5) * 100)}" for s in bot))

    unusual = sorted(rk, key=lambda s: -max(abs(s.get("z_foreign") or 0), abs(s.get("z_volume") or 0)))[:4]
    unusual = [s for s in unusual if max(abs(s.get("z_foreign") or 0), abs(s.get("z_volume") or 0)) >= 3]
    if unusual:
        L.append("")
        L.append("⚡ <b>Tak biasa hari ini</b>: " if lang == "id" else "⚡ <b>Unusual today</b>: ")
        for s in unusual:
            what = []
            if abs(s.get("z_foreign") or 0) >= 3:
                what.append(("asing borong" if s["z_foreign"] > 0 else "asing jual besar") if lang == "id" else ("heavy foreign buying" if s["z_foreign"] > 0 else "heavy foreign selling"))
            if abs(s.get("z_volume") or 0) >= 3:
                what.append(("volume melonjak" if s["z_volume"] > 0 else "volume sepi") if lang == "id" else ("volume spike" if s["z_volume"] > 0 else "volume dried up"))
            L.append(f"• {s['symbol']}: {', '.join(what)}")

    if watch:
        L.append("")
        L.append("⭐ <b>Pantauanmu</b>" if lang == "id" else "⭐ <b>Your watchlist</b>")
        for sym in watch:
            s = by.get(sym)
            if not s:
                continue
            L.append(f"• {sym} {_pct(s.get('ret_1'))} · {'besok' if lang == 'id' else 'next day'} {round((s.get('conf_1') or .5) * 100)} {V[verdict_of(s.get('q_1'))]} · "
                     f"{'1 bln' if lang == 'id' else '1 mo'} {round((s.get('conf_20') or .5) * 100)} {V[verdict_of(s.get('q_20'))]}")

    L.append("")
    L.append("<i>Skor = dari 100 kondisi serupa, berapa yang unggul dari separuh saham lain. 50 = lempar koin. Informasi, bukan nasihat keuangan.</i>"
             if lang == "id" else "<i>Score = of 100 similar cases, how many beat half of all stocks. 50 = coin flip. Information, not financial advice.</i>")
    return "\n".join(L)


def stock_text(bundle: dict, sym: str, lang: str = "id") -> str:
    V = VERDICT if lang == "id" else VERDICT_EN
    s = next((x for x in bundle["ranking"] if x["symbol"] == sym.upper()), None)
    if not s:
        return ("Saham tidak ditemukan di 120 saham yang dipantau Arus." if lang == "id" else "Stock not in Arus' 120-stock universe.")
    L = [f"<b>{s['symbol']}</b> · {s.get('name') or ''}",
         f"{'Harga' if lang == 'id' else 'Price'} {s.get('price'):,.0f} ({_pct(s.get('ret_1'))} {'hari ini' if lang == 'id' else 'today'})", ""]
    for h, nm in ((1, "Besok" if lang == "id" else "Next day"), (20, "1 bulan" if lang == "id" else "1 month")):
        L.append(f"{nm}: <b>{round((s.get(f'conf_{h}') or .5) * 100)}/100</b> · {V[verdict_of(s.get(f'q_{h}'))]}")
    if s.get("atr_pct"):
        L += ["", f"{'Gerak normal harian' if lang == 'id' else 'Normal daily move'} ±{s['atr_pct'] * 100:.1f}%",
              f"{'Batas bawah/atas 1 bln' if lang == 'id' else '1-mo floor/ceiling'}: {s.get('support_20'):,.0f} / {s.get('resistance_20'):,.0f}",
              f"{'Sinyal batal di bawah' if lang == 'id' else 'Signal void below'} {s.get('invalidate'):,.0f}"]
    L += ["", f"https://arus-idx.vercel.app/saham/{s['symbol']}/"]
    return "\n".join(L)


def export_digest(bundle: dict, graded: dict | None):
    """The website's Agent page shows exactly what subscribers received today."""
    web = config.ROOT / "web" / "src" / "data"
    out = {"as_of": bundle["meta"]["as_of"],
           "id": digest_text(bundle, graded, ["BBCA", "TLKM"], "id"),
           "en": digest_text(bundle, graded, ["BBCA", "TLKM"], "en")}
    (web / "digest.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    if not (web / "track.json").exists():
        (web / "track.json").write_text(json.dumps({"days": [], "totals": {}}), encoding="utf-8")


# ---------------------------------------------------------------------------
# telegram plumbing
# ---------------------------------------------------------------------------
def tg(method: str, token: str, **params):
    r = requests.post(f"https://api.telegram.org/bot{token}/{method}", json=params, timeout=60)
    return r.json()


def bot_db():
    config.DATA_DIR.mkdir(exist_ok=True)
    c = sqlite3.connect(BOT_DB)
    c.executescript("""CREATE TABLE IF NOT EXISTS chats (chat_id INTEGER PRIMARY KEY, lang TEXT DEFAULT 'id');
                       CREATE TABLE IF NOT EXISTS watch (chat_id INTEGER, symbol TEXT, PRIMARY KEY (chat_id, symbol));""")
    return c


def broadcast(text_for, token: str):
    db = bot_db()
    chats = db.execute("SELECT chat_id, lang FROM chats").fetchall()
    extra = env().get("TELEGRAM_CHAT_ID")
    if extra and int(extra) not in {c for c, _ in chats}:
        chats.append((int(extra), "id"))
    for chat_id, lang in chats:
        watch = [r[0] for r in db.execute("SELECT symbol FROM watch WHERE chat_id=?", (chat_id,))]
        tg("sendMessage", token, chat_id=chat_id, text=text_for(lang, watch), parse_mode="HTML", disable_web_page_preview=True)
    return len(chats)


HELP_ID = ("Perintah Arus:\n/hari_ini – ringkasan hari ini\n/saham KODE – skor & level penting satu saham\n"
           "/unggul – 10 saham paling diunggulkan\n/waspada – 10 saham bertanda waspada\n/pantau KODE – tambah ke pantauan\n"
           "/hapus KODE – hapus dari pantauan\n/pantauan – lihat pantauanmu\n/rapor – rekam jejak Arus\n/bahasa en – switch to English")
HELP_EN = ("Arus commands:\n/hari_ini – today's digest\n/saham CODE – score & key levels for a stock\n/unggul – top 10 strong edge\n"
           "/waspada – 10 caution flags\n/pantau CODE – add to watchlist\n/hapus CODE – remove\n/pantauan – your watchlist\n"
           "/rapor – Arus' track record\n/bahasa id – ganti ke Bahasa Indonesia")


def handle(text: str, chat_id: int, db) -> str:
    row = db.execute("SELECT lang FROM chats WHERE chat_id=?", (chat_id,)).fetchone()
    lang = row[0] if row else "id"
    parts = text.strip().split()
    cmd = parts[0].split("@")[0].lower() if parts else ""
    arg = parts[1].upper() if len(parts) > 1 else ""
    b = load_bundle()
    V = VERDICT if lang == "id" else VERDICT_EN
    if cmd == "/start":
        db.execute("INSERT OR IGNORE INTO chats (chat_id) VALUES (?)", (chat_id,))
        db.commit()
        return ("Halo! Saya Arus. Setiap sore hari bursa saya kirim ringkasan peluang saham IDX.\n\n" + HELP_ID) if lang == "id" else ("Hi! I'm Arus. Every trading-day evening I send an IDX odds digest.\n\n" + HELP_EN)
    if cmd in ("/help", "/bantuan"):
        return HELP_ID if lang == "id" else HELP_EN
    if cmd == "/bahasa" and arg.lower() in ("id", "en"):
        db.execute("INSERT INTO chats (chat_id, lang) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET lang=excluded.lang", (chat_id, arg.lower()))
        db.commit()
        return "Bahasa diubah ke Indonesia." if arg.lower() == "id" else "Language set to English."
    if cmd == "/hari_ini":
        watch = [r[0] for r in db.execute("SELECT symbol FROM watch WHERE chat_id=?", (chat_id,))]
        return digest_text(b, None, watch, lang)
    if cmd == "/saham" and arg:
        return stock_text(b, arg, lang)
    if cmd in ("/unggul", "/waspada"):
        h = 20
        rk = sorted(b["ranking"], key=lambda s: (s.get(f"conf_{h}") or 0), reverse=cmd == "/unggul")[:10]
        title = V["strong"] if cmd == "/unggul" else V["caution"]
        return f"<b>{title} · 1 {'bulan' if lang == 'id' else 'month'}</b>\n" + "\n".join(
            f"{i + 1}. {s['symbol']} {round((s.get(f'conf_{h}') or .5) * 100)}/100" for i, s in enumerate(rk))
    if cmd == "/pantau" and arg:
        db.execute("INSERT OR IGNORE INTO chats (chat_id) VALUES (?)", (chat_id,))
        db.execute("INSERT OR IGNORE INTO watch VALUES (?, ?)", (chat_id, arg))
        db.commit()
        return f"⭐ {arg} {'ditambahkan ke pantauan.' if lang == 'id' else 'added to your watchlist.'}"
    if cmd == "/hapus" and arg:
        db.execute("DELETE FROM watch WHERE chat_id=? AND symbol=?", (chat_id, arg))
        db.commit()
        return f"{arg} {'dihapus.' if lang == 'id' else 'removed.'}"
    if cmd == "/pantauan":
        syms = [r[0] for r in db.execute("SELECT symbol FROM watch WHERE chat_id=?", (chat_id,))]
        if not syms:
            return "Pantauan kosong. Tambah dengan /pantau KODE" if lang == "id" else "Empty. Add with /pantau CODE"
        return "\n\n".join(stock_text(b, s, lang) for s in syms[:8])
    if cmd == "/rapor":
        if not TRACK.exists():
            return "Rekam jejak live dimulai setelah hari bursa pertama agen berjalan." if lang == "id" else "The live track record starts after the agent's first trading day."
        t = json.loads(TRACK.read_text(encoding="utf-8"))["totals"]
        lines = [f"{V[v]}: {t[v]['won'] if v != 'caution' else t[v]['n'] - t[v]['won']}/{t[v]['n']} {'tepat' if lang == 'id' else 'correct'}" for v in ("strong", "caution") if v in t]
        return ("<b>Rekam jejak live (besok)</b>\n" if lang == "id" else "<b>Live track record (next day)</b>\n") + "\n".join(lines)
    return HELP_ID if lang == "id" else HELP_EN


def run_bot(token: str):
    db = bot_db()
    offset = None
    print("[bot] listening… (Ctrl+C to stop)", flush=True)
    while True:
        try:
            upd = tg("getUpdates", token, timeout=50, **({"offset": offset} if offset else {}))
        except requests.RequestException:
            time.sleep(5)
            continue
        for u in upd.get("result", []):
            offset = u["update_id"] + 1
            msg = u.get("message") or {}
            if "text" in msg:
                reply = handle(msg["text"], msg["chat"]["id"], db)
                tg("sendMessage", token, chat_id=msg["chat"]["id"], text=reply, parse_mode="HTML", disable_web_page_preview=True)


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["daily", "digest", "bot", "grade"])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cap", type=float, default=200, help="max credits for the refresh")
    ap.add_argument("--end", default=None, help="last trading day to pull (default: today)")
    args = ap.parse_args()
    token = env().get("TELEGRAM_BOT_TOKEN")

    if args.cmd == "bot":
        if not token:
            sys.exit("TELEGRAM_BOT_TOKEN missing in .env")
        run_bot(token)
        return

    if args.cmd == "daily":
        from arus import build, ingest
        before = load_bundle() if (SNAP / "arus.json").exists() else None
        if before:
            save_picks(before)
        c = SectorsClient(dry_run=args.dry_run, credit_cap=args.cap)
        conn = ingest.connect()
        end = date.fromisoformat(args.end) if args.end else date.today()
        if args.dry_run:
            n_hist = conn.execute("SELECT COUNT(*) FROM companies WHERE history=1").fetchone()[0]
            print(f"[agent] dry-run: ≈{n_hist + 22 + 2} credits per new trading day (since {ingest.last_date(conn)})")
            return
        info = ingest.pull_increment(c, conn, end)
        print(f"[agent] refresh: {info} · {c.summary()}", flush=True)
        if not info.get("new_days"):
            print("[agent] no new trading day — nothing to do")
            return
        sys.argv = ["build"]
        build.main()

    bundle = load_bundle()
    graded = grade(bundle) if args.cmd in ("daily", "grade") else None
    if graded:
        print(f"[agent] graded picks of {graded['picked_on']}: {graded['groups']}", flush=True)
    save_picks(bundle)
    export_digest(bundle, graded)
    if args.cmd == "grade":
        return
    if not token:
        print(digest_text(bundle, graded))
        print("\n[agent] (no TELEGRAM_BOT_TOKEN — printed instead of sent)")
        return
    n = broadcast(lambda lang, watch: digest_text(bundle, graded, watch, lang), token)
    print(f"[agent] digest sent to {n} chat(s) at {datetime.now():%H:%M}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
