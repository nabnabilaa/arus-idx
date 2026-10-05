"use client";

import { Download } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Download link for a build-time share card under /kartu/. */
export function ShareCard({ file, className = "" }: { file: string; className?: string }) {
  const { tx } = useLang();
  return (
    <a
      href={`/kartu/${file}`}
      download={file}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-ink-2 ring-1 ring-line transition-colors duration-150 hover:text-arus hover:ring-arus/40 ${className}`}
    >
      <Download size={13} />
      {tx({ id: "Unduh kartu", en: "Download card" })}
    </a>
  );
}
