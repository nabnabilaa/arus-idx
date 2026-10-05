"use client";

import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SUBSECTOR_ID } from "@/lib/features";
import { useLang } from "@/lib/i18n";

export type SearchIndex = {
  stocks: { s: string; n: string | null; sub: string | null }[];
  brokers: { c: string; n: string | null }[];
};

type Hit = { kind: "stock" | "broker" | "sector" | "page"; key: string; title: string; sub: string; href: string };

const PAGES: { href: string; id: string; en: string }[] = [
  { href: "/", id: "Hari ini", en: "Today" },
  { href: "/pantau/", id: "Pantauanku", en: "My watchlist" },
  { href: "/bandingkan/", id: "Bandingkan saham", en: "Compare stocks" },
  { href: "/sektor/", id: "Sektor", en: "Sectors" },
  { href: "/asing/", id: "Asing & bandar", en: "Foreign & brokers" },
  { href: "/broker/", id: "Direktori broker", en: "Broker directory" },
  { href: "/anomali/", id: "Tak biasa", en: "Unusual" },
  { href: "/rekap/", id: "Rekap pekan", en: "Week in review" },
  { href: "/orang-dalam/", id: "Orang dalam (insider)", en: "Insiders" },
  { href: "/agenda/", id: "Agenda: dividen, RUPS, rights issue", en: "Agenda: dividends, AGMs, rights issues" },
  { href: "/kejujuran/", id: "Bukti", en: "Proof" },
  { href: "/agen/", id: "Agen & Telegram", en: "Agent & Telegram" },
  { href: "/metodologi/", id: "Cara kerja", en: "How it works" },
];

/** Ctrl/⌘+K search across stocks, brokers, sectors and pages. */
export function Palette({ index }: { index: SearchIndex }) {
  const { tx, lang } = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const show = () => {
    setQ("");
    setSel(0);
    setOpen(true);
    setTimeout(() => input.current?.focus(), 20);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQ("");
        setSel(0);
        setOpen((o) => !o);
        setTimeout(() => input.current?.focus(), 20);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sectors = useMemo(() => Array.from(new Set(index.stocks.map((x) => x.sub).filter(Boolean))) as string[], [index.stocks]);
  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    const label = (sub: string) => (lang === "id" ? SUBSECTOR_ID[sub] ?? sub : sub);
    if (!t) return PAGES.map((p) => ({ kind: "page", key: p.href, title: lang === "id" ? p.id : p.en, sub: "", href: p.href }));
    const st = index.stocks
      .filter((x) => x.s.toLowerCase().startsWith(t) || (x.n ?? "").toLowerCase().includes(t))
      .sort((a, b) => Number(!a.s.toLowerCase().startsWith(t)) - Number(!b.s.toLowerCase().startsWith(t)))
      .slice(0, 7)
      .map((x) => ({ kind: "stock" as const, key: x.s, title: x.s, sub: x.n ?? "", href: `/saham/${x.s}/` }));
    const br = index.brokers
      .filter((x) => x.c.toLowerCase() === t || (t.length > 2 && (x.n ?? "").toLowerCase().includes(t)))
      .slice(0, 4)
      .map((x) => ({ kind: "broker" as const, key: x.c, title: x.c, sub: x.n ?? "", href: `/broker/${x.c}/` }));
    const se = t.length > 2 ? sectors.filter((k) => label(k).toLowerCase().includes(t) || k.toLowerCase().includes(t)).slice(0, 3).map((k) => ({ kind: "sector" as const, key: k, title: label(k), sub: "", href: "/sektor/" })) : [];
    const pg = PAGES.filter((p) => p.id.toLowerCase().includes(t) || p.en.toLowerCase().includes(t)).map((p) => ({ kind: "page" as const, key: p.href, title: lang === "id" ? p.id : p.en, sub: "", href: p.href }));
    return [...st, ...br, ...se, ...pg];
  }, [q, index, sectors, lang]);

  const go = (h: Hit) => {
    setOpen(false);
    router.push(h.href);
  };
  const KIND = { stock: tx({ id: "Saham", en: "Stock" }), broker: "Broker", sector: tx({ id: "Sektor", en: "Sector" }), page: tx({ id: "Halaman", en: "Page" }) };

  return (
    <>
      <button
        onClick={show}
        aria-label={tx({ id: "Cari", en: "Search" })}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-surface px-2.5 text-[12.5px] text-muted ring-1 ring-line hover:text-ink"
      >
        <Search size={14} />
        <span className="hidden sm:inline">{tx({ id: "Cari", en: "Search" })}</span>
        <kbd className="hidden rounded bg-raised px-1.5 text-[10.5px] text-muted ring-1 ring-line md:inline">Ctrl K</kbd>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto mt-[12vh] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-2xl bg-surface shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)] ring-1 ring-line-strong"
            >
              <label className="flex items-center gap-3 border-b border-line px-4">
                <Search size={17} className="text-muted" />
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setSel(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSel((x) => Math.min(hits.length - 1, x + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSel((x) => Math.max(0, x - 1));
                    } else if (e.key === "Enter" && hits[sel]) go(hits[sel]);
                  }}
                  placeholder={tx({ id: "Cari saham, broker, sektor, atau halaman…", en: "Search stocks, brokers, sectors or pages…" })}
                  className="h-14 w-full bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
                />
                <kbd className="rounded bg-raised px-1.5 text-[10.5px] text-muted ring-1 ring-line">Esc</kbd>
              </label>
              <ul className="max-h-[55vh] overflow-y-auto p-2">
                {hits.length === 0 && <li className="px-3 py-6 text-center text-[13.5px] text-muted">{tx({ id: "Tidak ditemukan.", en: "Nothing found." })}</li>}
                {hits.map((h, i) => (
                  <li key={`${h.kind}-${h.key}`}>
                    <button onMouseEnter={() => setSel(i)} onClick={() => go(h)} className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left ${i === sel ? "bg-raised" : ""}`}>
                      <span className="w-16 shrink-0 text-[11px] text-muted">{KIND[h.kind]}</span>
                      <span className="text-[14px] font-semibold text-ink">{h.title}</span>
                      <span className="min-w-0 truncate text-[12.5px] text-muted">{h.sub}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
