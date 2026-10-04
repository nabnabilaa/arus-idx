"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Numbered pages with previous/next; `noun` names what is being counted ("saham", "broker"). */
export function Pager({ page, pages, total, per, onChange, noun = { id: "saham", en: "stocks" } }: { page: number; pages: number; total: number; per: number; onChange: (p: number) => void; noun?: { id: string; en: string } }) {
  const { tx } = useLang();
  const nums = Array.from({ length: pages }, (_, i) => i).filter((i) => i === 0 || i === pages - 1 || Math.abs(i - page) <= 1);
  const from = page * per + 1;
  const to = Math.min(total, page * per + per);
  return (
    <nav aria-label={tx({ id: "Halaman", en: "Pages" })} className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <span className="text-[13px] text-muted">{tx({ id: `Menampilkan ${from}–${to} dari ${total} ${noun.id}`, en: `Showing ${from}–${to} of ${total} ${noun.en}` })}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-3 text-[13px] text-ink-2 ring-1 ring-line hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={15} />
          <span className="hidden sm:inline">{tx({ id: "Sebelumnya", en: "Previous" })}</span>
        </button>
        {nums.map((i, k) => (
          <span key={i} className="flex items-center">
            {k > 0 && i - nums[k - 1] > 1 && <span className="px-1 text-muted">…</span>}
            <button
              onClick={() => onChange(i)}
              aria-current={i === page ? "page" : undefined}
              className={`num h-9 min-w-9 cursor-pointer rounded-lg px-2 text-[13px] ${i === page ? "bg-arus font-semibold text-ground" : "text-ink-2 hover:bg-surface"}`}
            >
              {i + 1}
            </button>
          </span>
        ))}
        <button
          disabled={page >= pages - 1}
          onClick={() => onChange(page + 1)}
          className="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-3 text-[13px] text-ink-2 ring-1 ring-line hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="hidden sm:inline">{tx({ id: "Berikutnya", en: "Next" })}</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
