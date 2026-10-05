"use client";

import * as Popover from "@radix-ui/react-popover";
import { Palette, type SearchIndex } from "@/components/palette";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useLang, type Bi } from "@/lib/i18n";
import { Logo } from "./logo";

type Item = { href: string; label: Bi; note?: Bi };

/** What a first-time visitor (or a judge) should find in one glance. */
const PRIMARY: Item[] = [
  { href: "/", label: { id: "Hari ini", en: "Today" } },
  { href: "/rekap/", label: { id: "Rekap pekan", en: "Week" } },
  { href: "/anomali/", label: { id: "Tak biasa", en: "Unusual" } },
  { href: "/asing/", label: { id: "Asing & bandar", en: "Foreign & brokers" } },
  { href: "/orang-dalam/", label: { id: "Orang dalam", en: "Insiders" } },
  { href: "/agenda/", label: { id: "Agenda", en: "Agenda" } },
  { href: "/kejujuran/", label: { id: "Bukti", en: "Proof" } },
];

const MORE: Item[] = [
  { href: "/sektor/", label: { id: "Sektor", en: "Sectors" }, note: { id: "Peta dan rotasi sektor", en: "Sector map and rotation" } },
  { href: "/broker/", label: { id: "Broker", en: "Brokers" }, note: { id: "88 broker dan gaya belinya", en: "88 brokers and how they buy" } },
  { href: "/pantau/", label: { id: "Pantauan", en: "Watchlist" }, note: { id: "Saham yang kamu pantau", en: "Stocks you watch" } },
  { href: "/bandingkan/", label: { id: "Bandingkan", en: "Compare" }, note: { id: "2–4 saham berdampingan", en: "2–4 stocks side by side" } },
  { href: "/agen/", label: { id: "Agen & Telegram", en: "Agent & Telegram" }, note: { id: "Ringkasan harian dan bot", en: "Daily digest and bot" } },
  { href: "/metodologi/", label: { id: "Cara kerja", en: "How it works" }, note: { id: "Data, model, dan batasannya", en: "Data, model and limits" } },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/saham");
  // whole path segments only: "/agen/" must not light up on "/agenda/"
  return (path.endsWith("/") ? path : `${path}/`).startsWith(href);
}

function LangSwitch() {
  const { lang, setLang, tx } = useLang();
  return (
    <div role="radiogroup" aria-label={tx({ id: "Bahasa", en: "Language" })} className="relative flex shrink-0 rounded-lg bg-surface p-0.5 ring-1 ring-line">
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={`relative min-h-8 cursor-pointer rounded-md px-2.5 text-xs font-semibold uppercase transition-colors duration-150 ${lang === l ? "text-ground" : "text-muted hover:text-ink-2"}`}
        >
          {lang === l && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-md bg-arus" transition={{ type: "spring", stiffness: 600, damping: 40 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  );
}

function NavLink({ item, path }: { item: Item; path: string }) {
  const { tx } = useLang();
  const active = isActive(path, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] transition-colors duration-150 ${active ? "text-ink" : "text-muted hover:text-ink-2"}`}
    >
      {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-raised ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
      <span className="relative">{tx(item.label)}</span>
    </Link>
  );
}

function More({ path }: { path: string }) {
  const { tx } = useLang();
  const [open, setOpen] = useState(false);
  const active = MORE.some((m) => isActive(path, m.href));
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={`relative flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] transition-colors duration-150 ${active || open ? "text-ink" : "text-muted hover:text-ink-2"}`}
      >
        {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-raised ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
        <span className="relative">{tx({ id: "Lainnya", en: "More" })}</span>
        <ChevronDown size={14} className={`relative transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild align="end" sideOffset={10} collisionPadding={16}>
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -2, transition: { duration: 0.1 } }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
                className="z-50 w-72 rounded-xl border border-line-strong bg-raised/95 p-1.5 shadow-[0_12px_40px_-8px_rgb(0_0_0/0.6)] backdrop-blur-md"
              >
                {MORE.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-surface ${isActive(path, m.href) ? "bg-surface" : ""}`}
                  >
                    <span className="block text-[13.5px] text-ink">{tx(m.label)}</span>
                    {m.note && <span className="block text-[12px] text-muted">{tx(m.note)}</span>}
                  </Link>
                ))}
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

export function Nav({ index }: { index: SearchIndex }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Arus">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Arus</span>
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex" aria-label="Main">
          {PRIMARY.map((l) => (
            <NavLink key={l.href} item={l} path={path} />
          ))}
          <More path={path} />
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Palette index={index} />
          <LangSwitch />
        </div>
      </div>
      {/* phones: every page in one swipeable row */}
      <nav className="-mt-1 flex items-center gap-0.5 overflow-x-auto px-3 pb-2 [mask-image:linear-gradient(to_right,black_85%,transparent)] lg:hidden" aria-label="Main">
        {[...PRIMARY, ...MORE].map((l) => (
          <NavLink key={l.href} item={l} path={path} />
        ))}
      </nav>
    </header>
  );
}
