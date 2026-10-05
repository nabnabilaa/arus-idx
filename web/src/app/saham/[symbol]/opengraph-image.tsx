import { ImageResponse } from "next/og";
import { bundle } from "@/lib/data";
import { VERDICT, verdictOf } from "@/lib/verdict";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return bundle.ranking.map((r) => ({ symbol: r.symbol }));
}

const GRADE: Record<string, string> = { strong: "Sehat", fair: "Cukup", weak: "Lemah" };

/** A share card per stock: price, today's move, next-day call and financial health. */
export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const s = bundle.ranking.find((r) => r.symbol === symbol);
  const v = VERDICT[verdictOf(s?.q_1)];
  const up = (s?.ret_1 ?? 0) >= 0;
  const chg = `${up ? "+" : "−"}${Math.abs((s?.ret_1 ?? 0) * 100).toFixed(2).replace(".", ",")}%`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#070b14", color: "#e9eef6", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#5cc8ff" }}>Arus</div>
          <div style={{ fontSize: 24, color: "#75839a" }}>{`Data penutupan ${bundle.meta.as_of}`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
            <div style={{ fontSize: 120, fontWeight: 700 }}>{symbol}</div>
            <div style={{ fontSize: 56 }}>{(s?.price ?? 0).toLocaleString("id-ID")}</div>
            <div style={{ fontSize: 40, color: up ? "#5cc8ff" : "#e66767" }}>{chg}</div>
          </div>
          <div style={{ fontSize: 30, color: "#aab5c7" }}>{s?.name ?? ""}</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 26px", borderRadius: 18, border: "2px solid #1f2a3c" }}>
            <div style={{ fontSize: 22, color: "#75839a" }}>Penilaian besok</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: v.color }}>{v.label.id}</div>
          </div>
          {s?.fin_grade && (
            <div style={{ display: "flex", flexDirection: "column", padding: "18px 26px", borderRadius: 18, border: "2px solid #1f2a3c" }}>
              <div style={{ fontSize: 22, color: "#75839a" }}>Kesehatan keuangan</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{`${GRADE[s.fin_grade]} ${s.fin_score}/${s.fin_n}`}</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 26px", borderRadius: 18, border: "2px solid #1f2a3c" }}>
            <div style={{ fontSize: 22, color: "#75839a" }}>Asing sebulan</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: (s?.ff_net_20 ?? 0) >= 0 ? "#5cc8ff" : "#e66767" }}>{(s?.ff_net_20 ?? 0) >= 0 ? "Beli" : "Jual"}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
