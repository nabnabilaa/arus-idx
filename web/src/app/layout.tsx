import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { PrefsProvider } from "@/lib/prefs";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import brokersJson from "@/data/brokers.json";
import { bundle } from "@/lib/data";
import type { BrokerIndex } from "@/lib/types";

const searchIndex = {
  stocks: bundle.ranking.map((r) => ({ s: r.symbol, n: r.name, sub: r.sub_sector })),
  brokers: Object.entries(brokersJson as unknown as BrokerIndex).map(([c, b]) => ({ c, n: b.name })),
};

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://arus-idx.vercel.app"),
  openGraph: { siteName: "Arus", type: "website", locale: "id_ID" },
  twitter: { card: "summary_large_image" },
  title: "Arus — calibrated market intelligence for IDX",
  description:
    "Ranks Indonesian stocks by a probability calibrated on history, and shows exactly which evidence built the number.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <LangProvider>
          <PrefsProvider>
            <Nav index={searchIndex} />
            <main className="mx-auto max-w-[1320px] px-4 sm:px-6">{children}</main>
            <Footer />
          </PrefsProvider>
        </LangProvider>
      </body>
    </html>
  );
}
