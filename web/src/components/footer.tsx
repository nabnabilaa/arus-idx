"use client";

import { T } from "@/lib/i18n";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto max-w-[1320px] px-4 py-10 text-[12.5px] leading-relaxed text-muted sm:px-6">
        <p className="max-w-3xl">
          <T
            id="Arus adalah alat informasi dan analisis, bukan nasihat keuangan dan bukan ajakan membeli atau menjual efek. Skor yang ditampilkan adalah frekuensi historis pada data masa lalu, bukan jaminan hasil di masa depan. Keputusan dan risikonya sepenuhnya milik Anda."
            en="Arus is an information and analysis tool, not financial advice and not a solicitation to buy or sell securities. The scores shown are historical frequencies on past data, not a guarantee of future results. Decisions and their risks are entirely yours."
          />
        </p>
        <p className="mt-3">
          <T id="Data: Sectors API · Dibuat untuk Sectors Hackathon 2026" en="Data: Sectors API · Built for Sectors Hackathon 2026" />
        </p>
      </div>
    </footer>
  );
}
