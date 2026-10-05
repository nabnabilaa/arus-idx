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
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

from arus import config
from arus.client import SectorsClient
from arus.store import open_store

SNAP = config.SNAPSHOT_DIR
HIST = SNAP / "history"
TRACK = SNAP / "track.json"
# Vercel functions can only write to /tmp; without Redis configured that is where the bot keeps state.
BOT_DB = Path("/tmp/arus-telegram.db") if os.environ.get("VERCEL") else config.DATA_DIR / "telegram.db"

VERDICT = {"strong": "Sangat diunggulkan", "edge": "Diunggulkan", "neutral": "Netral",
           "weak": "Kurang diunggulkan", "caution": "Waspada"}
VERDICT_EN = {"strong": "Strong edge", "edge": "Edge", "neutral": "Neutral", "weak": "Weak", "caution": "Caution"}


def verdict_of(q: float | None) -> str:
    q = 0.5 if q is None else q
    return "strong" if q >= 0.9 else "edge" if q >= 0.7 else "neutral" if q > 0.3 else "weak" if q > 0.1 else "caution"


def env() -> dict:
    """Settings from the process environment (Vercel) overlaid with the local .env file."""
    out = {k: v for k, v in os.environ.items() if k.startswith(("TELEGRAM_", "KV_", "UPSTASH_", "ARUS_", "SECTORS_"))}
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


def proven(bundle: dict, h: int) -> bool:
    return bool(bundle["models"][str(h)]["metrics"].get("proven", True))


def published(bundle: dict) -> list[int]:
    """Horizons that passed validation; a failed model is withheld rather than shown with a caveat."""
    return [h for h in (1, 20) if proven(bundle, h)] or [1]


def _tilt(bundle: dict | None, sym: str):
    d = ((bundle or {}).get("brokerSummary") or {}).get(sym, {}).get("5")
    if not d or d["top5_buy"] + d["top5_sell"] <= 0:
        return None
    return (d["top5_buy"] - d["top5_sell"]) / (d["top5_buy"] + d["top5_sell"])


def watch_alerts(bundle: dict, prev: dict | None, sym: str, lang: str = "id") -> list[str]:
    """What changed today for one watched stock that is worth a ping."""
    s = next((x for x in bundle["ranking"] if x["symbol"] == sym), None)
    if not s:
        return []
    id_ = lang == "id"
    out = []
    zf, zv, zr = s.get("z_foreign") or 0, s.get("z_volume") or 0, s.get("z_return") or 0
    if abs(zf) >= 3:
        amt = abs(s.get("ff_today") or 0) / 1e9
        out.append((f"asing {'borong' if zf > 0 else 'jual besar'} Rp{amt:.1f} M" if id_ else
                    f"heavy foreign {'buying' if zf > 0 else 'selling'} IDR {amt:.1f}B"))
    if zv >= 3:
        out.append(f"volume melonjak {s.get('vol_mult') or 0:.1f}×" if id_ else f"volume spike {s.get('vol_mult') or 0:.1f}×")
    if abs(zr) >= 3:
        out.append(f"harga bergerak tajam {_pct(s.get('ret_1'))}" if id_ else f"sharp price move {_pct(s.get('ret_1'))}")
    px = s.get("price") or 0
    if s.get("invalidate") and px < s["invalidate"]:
        out.append(f"di bawah batas sinyal batal {s['invalidate']:,.0f}" if id_ else f"below the signal-void level {s['invalidate']:,.0f}")
    elif s.get("support_20") and px < s["support_20"]:
        out.append(f"jebol batas bawah 1 bln {s['support_20']:,.0f}" if id_ else f"broke the 1-mo floor {s['support_20']:,.0f}")
    if s.get("resistance_20") and px > s["resistance_20"]:
        out.append(f"menembus batas atas 1 bln {s['resistance_20']:,.0f}" if id_ else f"broke above the 1-mo ceiling {s['resistance_20']:,.0f}")
    RISK_WORD = {"watch_board": ("masuk papan pemantauan khusus", "on the special watch board"),
                 "cooling_down": ("di-cooling down bursa", "halted for cooling-down"),
                 "suspended": ("disuspensi bursa", "suspended by the exchange"),
                 "insider_selling": ("orang dalam menjual", "insiders selling"),
                 "dilution": ("rights issue mengencerkan", "dilutive rights issue ahead"),
                 "pump_like": ("pola mirip pompom", "pump-like broker days")}
    old = set(next((x for x in (prev or {}).get("ranking", []) if x["symbol"] == sym), {}).get("risk_flags") or [])
    for f in (s.get("risk_flags") or []):
        if f not in old and f in RISK_WORD:
            out.append(("tanda risiko baru: " if id_ else "new risk flag: ") + RISK_WORD[f][0 if id_ else 1])
    t0, t1 = _tilt(prev, sym), _tilt(bundle, sym)
    if t0 is not None and t1 is not None and abs(t1) > 0.15 and (t0 > 0.15) != (t1 > 0.15) and (t0 < -0.15) != (t1 < -0.15):
        a = ("akumulasi" if t0 > 0.15 else "distribusi" if t0 < -0.15 else "seimbang") if id_ else ("accumulation" if t0 > 0.15 else "distribution" if t0 < -0.15 else "balanced")
        b = ("akumulasi" if t1 > 0 else "distribusi") if id_ else ("accumulation" if t1 > 0 else "distribution")
        out.append(f"arah broker berbalik: {a} → {b}" if id_ else f"broker tilt flipped: {a} → {b}")
    return out


AGENDA_WORD = {"dividend": ("ex-dividen", "ex-dividend"), "agm": ("RUPS", "AGM"), "right_issue": ("rights issue", "rights issue"),
               "stock_split": ("stock split", "stock split"), "warrant": ("waran", "warrant"), "bonus": ("saham bonus", "bonus shares")}


def agenda_soon(as_of: str, days: int = 5) -> list[dict]:
    """Corporate actions in the next few calendar days, from the snapshot's agenda.json."""
    path = SNAP / "agenda.json"
    if not path.exists():
        return []
    end = (date.fromisoformat(as_of) + timedelta(days=days + 2)).isoformat()
    items = json.loads(path.read_text(encoding="utf-8")).get("upcoming", [])
    return [it for it in items if as_of < it["date"] <= end]


def agenda_line(it: dict, lang: str = "id", symbol: bool = True) -> str:
    word = AGENDA_WORD.get(it["type"], (it["type"], it["type"]))[0 if lang == "id" else 1]
    extra = ""
    if it["type"] == "dividend" and it.get("amt"):
        amt = f"{it['amt']:,.0f}" if it["amt"] >= 10 else f"{it['amt']:g}"
        extra = f" Rp{amt}" + (f" (yield {it['yield'] * 100:.1f}%)" if it.get("yield") else "")
    return f"{it['s'] + ' ' if symbol else ''}{word} {it['date'][8:10]}/{it['date'][5:7]}{extra}"


def digest_text(bundle: dict, graded: dict | None, watch: list[str] | None = None, lang: str = "id", prev: dict | None = None) -> str:
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
        if h not in published(bundle):
            continue
        top = sorted(rk, key=lambda s: -(s.get(f"q_{h}") or 0))[:5]
        bot = sorted(rk, key=lambda s: (s.get(f"q_{h}") or 0))[:5]
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

    soon = agenda_soon(d)
    key = [it for it in soon if it["type"] != "agm"][:6]
    if key:
        L.append("")
        L.append(("📅 <b>Agenda dekat</b>: " if lang == "id" else "📅 <b>Coming up</b>: ") + " · ".join(agenda_line(it, lang) for it in key))

    pings = [(sym, watch_alerts(bundle, prev, sym, lang) + [agenda_line(it, lang, symbol=False) for it in soon if it["s"] == sym])
             for sym in (watch or [])]
    pings = [(sym, a) for sym, a in pings if a]
    if pings:
        L.append("")
        L.append("🔔 <b>Peringatan pantauan</b>" if lang == "id" else "🔔 <b>Watchlist alerts</b>")
        for sym, a in pings:
            L.append(f"• <b>{sym}</b>: {'; '.join(a)}")

    if watch:
        L.append("")
        L.append("⭐ <b>Pantauanmu</b>" if lang == "id" else "⭐ <b>Your watchlist</b>")
        for sym in watch:
            s = by.get(sym)
            if not s:
                continue
            line = f"• {sym} {_pct(s.get('ret_1'))} · {'besok' if lang == 'id' else 'next day'} {round((s.get('conf_1') or .5) * 100)} {V[verdict_of(s.get('q_1'))]}"
            if 20 in published(bundle):
                line += f" · {'1 bln' if lang == 'id' else '1 mo'} {round((s.get('conf_20') or .5) * 100)} {V[verdict_of(s.get('q_20'))]}"
            L.append(line)

    L.append("")
    L.append("<i>Skor = dari 100 kondisi serupa, berapa yang unggul dari separuh saham lain. 50 = sama dengan memilih acak. Informasi, bukan nasihat keuangan.</i>"
             if lang == "id" else "<i>Score = of 100 similar cases, how many beat half of all stocks. 50 = no better than random. Information, not financial advice.</i>")
    return "\n".join(L)


def weekly_text(lang: str = "id") -> str | None:
    """The weekly recap as a Telegram message, from the snapshot's weekly.json."""
    path = SNAP / "weekly.json"
    if not path.exists():
        return None
    w = json.loads(path.read_text(encoding="utf-8"))
    if not w:
        return None
    id_ = lang == "id"
    st = w["stats"]
    L = [f"📊 <b>{'Rekap pekan' if id_ else 'Week in review'} · {w['from']} – {w['to']}</b>"]
    L.append(f"IHSG {_pct(st['ihsg'])} · {'naik' if id_ else 'up'} {st['up']} vs {'turun' if id_ else 'down'} {st['down']} · "
             f"{'asing' if id_ else 'foreign'} {'+' if st['foreign'] >= 0 else '−'}Rp{abs(st['foreign']) / 1e12:.2f} T")
    for key, title in (("pos", ("👍 Yang mendukung", "👍 What supports")), ("neg", ("⚠️ Yang perlu diwaspadai", "⚠️ What to be careful about"))):
        if w["reads"][key]:
            L.append("")
            L.append(f"<b>{title[0 if id_ else 1]}</b>")
            L.extend(f"• {r['id' if id_ else 'en']}" for r in w["reads"][key])
    L.append("")
    L.append(("🚀 Naik: " if id_ else "🚀 Up: ") + ", ".join(f"{m['s']} {_pct(m['ret'])}" for m in w["gainers"][:4]))
    L.append(("🔻 Turun: " if id_ else "🔻 Down: ") + ", ".join(f"{m['s']} {_pct(m['ret'])}" for m in w["losers"][:4]))
    L.append(("🌏 Diborong asing: " if id_ else "🌏 Foreign buying: ") + ", ".join(m["s"] for m in w["foreign"]["buy"][:4]))
    if w.get("ahead"):
        L.append(("📅 Pekan depan: " if id_ else "📅 Next week: ") + " · ".join(agenda_line(it, lang) for it in w["ahead"][:4]))
    L.append("")
    L.append("<i>Disusun otomatis dari data BEI dan Sectors. Informasi, bukan nasihat keuangan.</i>" if id_
             else "<i>Built automatically from IDX and Sectors data. Information, not financial advice.</i>")
    return "\n".join(L)


def stock_text(bundle: dict, sym: str, lang: str = "id") -> str:
    V = VERDICT if lang == "id" else VERDICT_EN
    s = next((x for x in bundle["ranking"] if x["symbol"] == sym.upper()), None)
    if not s:
        return (f"Saham tidak ditemukan di {len(bundle['ranking'])} saham yang dipantau Arus." if lang == "id" else f"Stock not in Arus' {len(bundle['ranking'])}-stock universe.")
    L = [f"<b>{s['symbol']}</b> · {s.get('name') or ''}",
         f"{'Harga' if lang == 'id' else 'Price'} {s.get('price'):,.0f} ({_pct(s.get('ret_1'))} {'hari ini' if lang == 'id' else 'today'})", ""]
    for h, nm in ((1, "Besok" if lang == "id" else "Next day"), (20, "1 bulan" if lang == "id" else "1 month")):
        if h in published(bundle):
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


def store():
    return open_store(env(), BOT_DB)


def apply_prefs(stocks: list[dict], p: dict) -> list[dict]:
    out = stocks
    if p.get("sharia"):
        out = [s for s in out if s.get("sharia")]
    if p.get("max_price"):
        out = [s for s in out if (s.get("price") or 0) <= p["max_price"]]
    return out


ASK_RULES = (
    "Kamu adalah Arus, asisten informasi saham IDX. Jawab HANYA berdasarkan DATA ARUS di bawah. "
    "Skor = dari 100 kondisi serupa di masa lalu, berapa yang unggul dari separuh saham lain (50 = sama dengan memilih acak). "
    "Jangan pernah menyuruh membeli atau menjual; beri informasi, pertimbangan, dan risiko. Sebut data yang bertentangan. "
    "Hanya pakai skor untuk jangka waktu di published_horizons; jangan menyebut atau menebak skor jangka lain. "
    "Kalau data tidak ada, katakan tidak tahu. Jawab singkat (maks 900 karakter), bahasa sesuai pertanyaan, tanpa markdown tabel."
)


def ask(question: str, bundle: dict, p: dict) -> str:
    """Free-form question → answer grounded in the snapshot, via the CLI named in ARUS_ASK_CMD."""
    import re
    import shutil
    import subprocess
    cmd = env().get("ARUS_ASK_CMD", "").strip()
    lang = p.get("lang", "id")
    if not cmd:
        return ("Untuk bertanya bebas, isi ARUS_ASK_CMD di .env dengan perintah CLI model bahasa yang menerima pertanyaan lewat stdin. Sementara itu coba /saham KODE atau /hari_ini."
                if lang == "id" else "Free-form questions need ARUS_ASK_CMD in .env: a language-model CLI that reads the prompt from stdin. Meanwhile try /saham CODE or /hari_ini.")
    parts = cmd.split()
    exe = shutil.which(parts[0]) or shutil.which(parts[0] + ".cmd")
    if not exe:
        return "Mesin jawaban tidak ditemukan di server bot." if lang == "id" else "Answer engine not found on the bot host."
    by = {s["symbol"]: s for s in bundle["ranking"]}
    mentioned = [w for w in re.findall(r"\b[A-Za-z]{4}\b", question) if w.upper() in by][:5]
    keep = ["symbol", "name", "sector", "price", "ret_1", "ret_20", "conf_1", "q_1", "conf_20", "q_20", "atr_pct",
            "support_20", "resistance_20", "invalidate", "ff_net_20", "ff_net_5", "z_foreign", "z_volume",
            "drivers_pos_20", "drivers_neg_20", "broker_tone", "sharia", "pe_ttm", "pb_mrq", "roe_ttm"]
    ctx = {
        "as_of": bundle["meta"]["as_of"],
        "stocks_asked": [{k: by[m.upper()].get(k) for k in keep
                          if 20 in published(bundle) or k not in ("conf_20", "q_20", "drivers_pos_20", "drivers_neg_20")}
                         for m in mentioned],
        "broker_footprint": {m.upper(): bundle["brokers"].get(m.upper(), {}).get("verdict") for m in mentioned},
        "published_horizons": ["next_day" if h == 1 else "one_month" for h in published(bundle)],
        "top_next_day": [s["symbol"] for s in sorted(apply_prefs(bundle["ranking"], p), key=lambda s: -(s.get("q_1") or 0))[:8]],
        "caution_next_day": [s["symbol"] for s in sorted(apply_prefs(bundle["ranking"], p), key=lambda s: (s.get("q_1") or 0))[:8]],
        **({"top_1_month": [s["symbol"] for s in sorted(apply_prefs(bundle["ranking"], p), key=lambda s: -(s.get("q_20") or 0))[:8]],
            "caution_1_month": [s["symbol"] for s in sorted(apply_prefs(bundle["ranking"], p), key=lambda s: (s.get("q_20") or 0))[:8]]}
           if 20 in published(bundle) else {}),
        "user_filters": {"sharia_only": p.get("sharia"), "max_price": p.get("max_price")},
    }
    prompt = f"{ASK_RULES}\n\nDATA ARUS:\n{json.dumps(ctx, ensure_ascii=False, default=str)}\n\nPERTANYAAN: {question}"
    try:
        r = subprocess.run([exe, *parts[1:]], input=prompt, capture_output=True, text=True, encoding="utf-8", timeout=180)
        out = (r.stdout or "").strip()
        out = out.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        out = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", out)
        out = re.sub(r"^#+\s*", "", out, flags=re.M)
        return out[:3500] if out else ("Maaf, belum bisa menjawab sekarang." if lang == "id" else "Sorry, I can't answer right now.")
    except (subprocess.SubprocessError, OSError):
        return "Maaf, mesin jawaban sedang sibuk." if lang == "id" else "Sorry, the answer engine is busy."


def broadcast(text_for, token: str):
    st = store()
    chats = st.chats()
    extra = env().get("TELEGRAM_CHAT_ID")
    if extra and int(extra) not in chats:
        chats.append(int(extra))
    for chat_id in chats:
        lang = st.prefs(chat_id)["lang"]
        tg("sendMessage", token, chat_id=chat_id, text=text_for(lang, st.watch(chat_id)), parse_mode="HTML", disable_web_page_preview=True)
    return len(chats)


HELP_ID = ("Perintah Arus:\n/hari_ini – ringkasan hari ini\n/saham KODE – skor & level penting satu saham\n"
           "/unggul – 10 saham paling diunggulkan\n/waspada – 10 saham bertanda waspada\n/pantau KODE – tambah ke pantauan\n"
           "/hapus KODE – hapus dari pantauan\n/pantauan – lihat pantauanmu\n/rapor – rekam jejak Arus\n"
           "/syariah on|off – hanya saham syariah\n/harga 1000 – batas harga maks (/harga semua untuk hapus)\n"
           "/pengaturan – lihat filter Anda\n/bahasa en – switch to English\n\n"
           "Atau ketik pertanyaan bebas, misal: BBRI masih layak dipantau?")
HELP_EN = ("Arus commands:\n/hari_ini – today's digest\n/saham CODE – score & key levels for a stock\n/unggul – top 10 strong edge\n"
           "/waspada – 10 caution flags\n/pantau CODE – add to watchlist\n/hapus CODE – remove\n/pantauan – your watchlist\n"
           "/rapor – Arus' track record\n/syariah on|off – sharia stocks only\n/harga 1000 – max price (/harga semua to clear)\n"
           "/pengaturan – your filters\n/bahasa id – ganti ke Bahasa Indonesia\n\nOr just ask, e.g.: is BBRI still worth watching?")


def handle(text: str, chat_id: int, st) -> str:
    p = st.prefs(chat_id)
    lang = p["lang"]
    parts = text.strip().split()
    cmd = parts[0].split("@")[0].lower() if parts else ""
    arg = parts[1].upper() if len(parts) > 1 else ""
    b = load_bundle()
    V = VERDICT if lang == "id" else VERDICT_EN
    if cmd == "/start":
        st.set(chat_id)
        return ("Halo! Saya Arus. Setiap sore hari bursa saya kirim ringkasan peluang saham IDX.\n\n" + HELP_ID) if lang == "id" else ("Hi! I'm Arus. Every trading-day evening I send an IDX odds digest.\n\n" + HELP_EN)
    if cmd in ("/help", "/bantuan"):
        return HELP_ID if lang == "id" else HELP_EN
    if cmd == "/bahasa" and arg.lower() in ("id", "en"):
        st.set(chat_id, lang=arg.lower())
        return "Bahasa diubah ke Indonesia." if arg.lower() == "id" else "Language set to English."
    if cmd == "/hari_ini":
        return digest_text(b, None, st.watch(chat_id), lang)
    if cmd == "/saham" and arg:
        return stock_text(b, arg, lang)
    if cmd in ("/unggul", "/waspada"):
        h = published(b)[0]
        pool = apply_prefs(b["ranking"], p)
        rk = sorted(pool, key=lambda s: (s.get(f"conf_{h}") or 0), reverse=cmd == "/unggul")[:10]
        title = V["strong"] if cmd == "/unggul" else V["caution"]
        note = []
        if p["sharia"]:
            note.append("syariah" if lang == "id" else "sharia")
        if p["max_price"]:
            note.append(f"≤ {p['max_price']:,.0f}")
        span = ("besok" if lang == "id" else "next day") if h == 1 else ("1 bulan" if lang == "id" else "1 month")
        head = f"<b>{title} · {span}</b>" + (f" ({', '.join(note)})" if note else "")
        return head + "\n" + "\n".join(f"{i + 1}. {s['symbol']} {round((s.get(f'conf_{h}') or .5) * 100)}/100 · {s.get('price'):,.0f}" for i, s in enumerate(rk))
    if cmd == "/syariah" and arg.lower() in ("on", "off"):
        st.set(chat_id, sharia=arg.lower() == "on")
        return ("Filter syariah aktif (anggota JII70)." if arg.lower() == "on" else "Filter syariah dimatikan.") if lang == "id" else ("Sharia filter on (JII70 members)." if arg.lower() == "on" else "Sharia filter off.")
    if cmd == "/harga" and arg:
        if arg.lower() in ("SEMUA".lower(), "all"):
            st.set(chat_id, max_price=None)
            return "Batas harga dihapus." if lang == "id" else "Price limit cleared."
        try:
            v = float(arg.replace(".", "").replace(",", ""))
            st.set(chat_id, max_price=v)
            return f"Hanya menampilkan saham berharga ≤ {v:,.0f}." if lang == "id" else f"Showing stocks priced ≤ {v:,.0f} only."
        except ValueError:
            return "Contoh: /harga 1000" if lang == "id" else "Example: /harga 1000"
    if cmd == "/pengaturan":
        return (f"Bahasa: {p['lang']}\nSyariah saja: {'ya' if p['sharia'] else 'tidak'}\nHarga maks: {p['max_price'] or 'semua'}"
                if lang == "id" else f"Language: {p['lang']}\nSharia only: {'yes' if p['sharia'] else 'no'}\nMax price: {p['max_price'] or 'any'}")
    if cmd == "/pantau" and arg:
        if not any(x["symbol"] == arg for x in b["ranking"]):
            return f"{arg} {'tidak ada di saham yang dipantau Arus.' if lang == 'id' else 'is not in the Arus universe.'}"
        st.add_watch(chat_id, arg)
        return f"⭐ {arg} {'ditambahkan ke pantauan.' if lang == 'id' else 'added to your watchlist.'}"
    if cmd == "/hapus" and arg:
        st.remove_watch(chat_id, arg)
        return f"{arg} {'dihapus.' if lang == 'id' else 'removed.'}"
    if cmd == "/pantauan":
        syms = st.watch(chat_id)
        if not syms:
            return "Pantauan kosong. Tambah dengan /pantau KODE" if lang == "id" else "Empty. Add with /pantau CODE"
        return "\n\n".join(stock_text(b, s, lang) for s in syms[:8])
    if cmd == "/rapor":
        if not TRACK.exists():
            return "Rekam jejak live dimulai setelah hari bursa pertama agen berjalan." if lang == "id" else "The live track record starts after the agent's first trading day."
        t = json.loads(TRACK.read_text(encoding="utf-8"))["totals"]
        lines = [f"{V[v]}: {t[v]['won'] if v != 'caution' else t[v]['n'] - t[v]['won']}/{t[v]['n']} {'tepat' if lang == 'id' else 'correct'}" for v in ("strong", "caution") if v in t]
        return ("<b>Rekam jejak live (besok)</b>\n" if lang == "id" else "<b>Live track record (next day)</b>\n") + "\n".join(lines)
    if not cmd.startswith("/"):
        return ask(text, b, p)
    return HELP_ID if lang == "id" else HELP_EN


BOT_COMMANDS = [
    ("hari_ini", "Ringkasan hari ini", "Today's digest"),
    ("saham", "Skor & level penting satu saham, misal /saham BBRI", "Score & key levels, e.g. /saham BBRI"),
    ("unggul", "10 saham paling diunggulkan", "Top 10 strong edge"),
    ("waspada", "10 saham bertanda waspada", "10 caution flags"),
    ("pantau", "Tambah ke pantauan, misal /pantau TLKM", "Add to watchlist, e.g. /pantau TLKM"),
    ("pantauan", "Lihat pantauan Anda", "Your watchlist"),
    ("syariah", "Hanya saham syariah: /syariah on", "Sharia only: /syariah on"),
    ("harga", "Batas harga maks: /harga 1000", "Max price: /harga 1000"),
    ("rapor", "Rekam jejak live Arus", "Arus' live track record"),
    ("bahasa", "Ganti bahasa: /bahasa en", "Switch language: /bahasa id"),
]


def setup_bot(token: str):
    """Give the bot its Arus identity: name, descriptions and command menu (ID + EN)."""
    calls = [
        ("setMyName", {"name": "Arus · Peluang Saham IDX"}),
        ("setMyName", {"name": "Arus · IDX Stock Odds", "language_code": "en"}),
        ("setMyShortDescription", {"short_description": "Skor peluang saham IDX yang teruji, setiap hari bursa."}),
        ("setMyShortDescription", {"short_description": "Tested odds for IDX stocks, every trading day.", "language_code": "en"}),
        ("setMyDescription", {"description": "Arus menilai ratusan saham paling aktif di BEI setiap hari dari data Sectors dan memberi skor peluang yang sudah diuji ke data setahun. Ketik /start untuk mulai. Informasi, bukan nasihat keuangan."}),
        ("setMyDescription", {"description": "Arus scores hundreds of the most active IDX stocks daily from Sectors data, with odds tested on a year of history. Send /start to begin. Information, not financial advice.", "language_code": "en"}),
        ("setMyCommands", {"commands": [{"command": c, "description": d} for c, d, _ in BOT_COMMANDS]}),
        ("setMyCommands", {"commands": [{"command": c, "description": e} for c, _, e in BOT_COMMANDS], "language_code": "en"}),
    ]
    for method, params in calls:
        r = tg(method, token, **params)
        print(f"[setup] {method}{' (en)' if params.get('language_code') else ''}: {'ok' if r.get('ok') else r.get('description')}")
    me = tg("getMe", token).get("result", {})
    print(f"[setup] bot is now @{me.get('username')} · name: {me.get('first_name')}")


def run_bot(token: str):
    st = store()
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
                reply = handle(msg["text"], msg["chat"]["id"], st)
                tg("sendMessage", token, chat_id=msg["chat"]["id"], text=reply, parse_mode="HTML", disable_web_page_preview=True)


def handle_update(update: dict, token: str):
    """One Telegram update, as delivered to the Vercel webhook (api/telegram.py)."""
    msg = update.get("message") or {}
    if "text" in msg:
        reply = handle(msg["text"], msg["chat"]["id"], store())
        tg("sendMessage", token, chat_id=msg["chat"]["id"], text=reply, parse_mode="HTML", disable_web_page_preview=True)


def set_webhook(token: str, url: str, secret: str | None):
    """Point Telegram at the deployed webhook (and stop long polling)."""
    r = tg("setWebhook", token, url=url, **({"secret_token": secret} if secret else {}), drop_pending_updates=True)
    print(f"[webhook] {url}: {'ok' if r.get('ok') else r.get('description')}")


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["daily", "digest", "bot", "grade", "setup-bot", "set-webhook"])
    ap.add_argument("--url", default=None, help="webhook URL for set-webhook, e.g. https://<bot>.vercel.app/api/telegram")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cap", type=float, default=200, help="max credits for the refresh (--source sectors only)")
    ap.add_argument("--source", choices=["idx", "sectors"], default="idx",
                    help="daily prices and foreign flow: the free IDX summary (default) or Sectors credits")
    ap.add_argument("--end", default=None, help="last trading day to pull (default: today)")
    args = ap.parse_args()
    token = env().get("TELEGRAM_BOT_TOKEN")

    if args.cmd in ("bot", "setup-bot", "set-webhook"):
        if not token:
            sys.exit("TELEGRAM_BOT_TOKEN missing in .env")
        if args.cmd == "set-webhook":
            if not args.url:
                sys.exit("--url is required")
            set_webhook(token, args.url, env().get("TELEGRAM_WEBHOOK_SECRET"))
        elif args.cmd == "setup-bot":
            setup_bot(token)
        else:
            tg("deleteWebhook", token)            # long polling and a webhook can't run together
            run_bot(token)
        return

    before = None
    if args.cmd == "daily":
        from arus import build, ingest
        before = load_bundle() if (SNAP / "arus.json").exists() else None
        if before:
            save_picks(before)
        conn = ingest.connect()
        end = date.fromisoformat(args.end) if args.end else date.today()
        if args.source == "idx":
            from arus import idx
            last = ingest.last_date(conn)
            sys.argv = ["idx", "--until", end.isoformat()]
            idx.main()
            if ingest.last_date(conn) == last:
                print("[agent] no new trading day — nothing to do")
                return
            sys.argv = ["build"]
            build.main()
            args.source = "done"
        c = SectorsClient(dry_run=args.dry_run, credit_cap=args.cap)
        if args.source == "done":
            pass
        elif args.dry_run:
            n_hist = conn.execute("SELECT COUNT(*) FROM companies WHERE history=1").fetchone()[0]
            print(f"[agent] dry-run: ≈{n_hist + 22 + 2} credits per new trading day (since {ingest.last_date(conn)})")
            return
        else:
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
    n = broadcast(lambda lang, watch: digest_text(bundle, graded, watch, lang, prev=before), token)
    print(f"[agent] digest sent to {n} chat(s) at {datetime.now():%H:%M}")
    if date.fromisoformat(bundle["meta"]["as_of"]).weekday() == 4 and weekly_text():   # Friday close: the week's recap too
        n = broadcast(lambda lang, watch: weekly_text(lang) or "", token)
        print(f"[agent] weekly recap sent to {n} chat(s)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
