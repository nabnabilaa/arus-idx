"use client";

import { motion } from "motion/react";
import { useId } from "react";

/** Underline tabs that scroll horizontally on small screens. */
export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode; badge?: React.ReactNode }[]; label: string }) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={`relative flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[14px] transition-colors duration-150 ${active ? "text-ink" : "text-muted hover:text-ink-2"}`}
          >
            {it.label}
            {it.badge}
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-arus" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          </button>
        );
      })}
    </div>
  );
}
