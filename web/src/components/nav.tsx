"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useLang, type Bi } from "@/lib/i18n";
import { Logo } from "./logo";

const LINKS: { href: string; label: Bi }[] = [
  { href: "/", label: { id: "Hari ini", en: "Today" } },
  { href: "/sektor/", label: { id: "Sektor", en: "Sectors" } },
  { href: "/asing/", label: { id: "Asing & bandar", en: "Foreign & brokers" } },
  { href: "/broker/", label: { id: "Broker", en: "Brokers" } },
  { href: "/anomali/", label: { id: "Tak biasa", en: "Unusual" } },
  { href: "/kejujuran/", label: { id: "Bukti", en: "Proof" } },
  { href: "/agen/", label: { id: "Agen & Telegram", en: "Agent & Telegram" } },
  { href: "/metodologi/", label: { id: "Cara kerja", en: "How it works" } },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/saham");
  return path.startsWith(href.replace(/\/$/, ""));
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

export function Nav() {
  const path = usePathname();
  const { tx } = useLang();
  const links = (
    <nav className="flex items-center gap-0.5" aria-label="Main">
      {LINKS.map((l) => {
        const active = isActive(path, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] transition-colors duration-150 ${active ? "text-ink" : "text-muted hover:text-ink-2"}`}
          >
            {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-raised ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{tx(l.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Arus">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Arus</span>
        </Link>
        <div className="hidden min-w-0 flex-1 overflow-x-auto lg:block">{links}</div>
        <div className="ml-auto lg:ml-0">
          <LangSwitch />
        </div>
      </div>
      <div className="-mt-1 overflow-x-auto px-3 pb-2 [mask-image:linear-gradient(to_right,black_85%,transparent)] lg:hidden">{links}</div>
    </header>
  );
}
