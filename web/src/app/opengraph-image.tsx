import { ImageResponse } from "next/og";
import { bundle } from "@/lib/data";

export const dynamic = "force-static";
export const alt = "Arus — intelijen pasar saham IDX";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#070b14", color: "#e9eef6", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#5cc8ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#070b14", fontSize: 34, fontWeight: 700 }}>≈</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>Arus</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>Apa yang sebenarnya terjadi di balik sebuah saham.</div>
          <div style={{ fontSize: 30, color: "#aab5c7" }}>{`${bundle.ranking.length} saham IDX · bandar · kesehatan keuangan · rentang wajar · diuji jujur`}</div>
        </div>
        <div style={{ fontSize: 24, color: "#75839a" }}>Data: Sectors API · Sectors Hackathon 2026</div>
      </div>
    ),
    size,
  );
}
