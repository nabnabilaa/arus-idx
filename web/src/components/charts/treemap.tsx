"use client";

import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Tooltip, useWidth } from "./kit";
import { SECTOR_ID } from "@/lib/features";
import { signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { VERDICT, verdictOf } from "@/lib/verdict";
import type { Horizon, Stock } from "@/lib/types";

type Mode = "score" | "move";

/** Market map à la TradingView: tiles sized by market cap, grouped by sector. */
export function MarketMap({ stocks, horizon, mode, height = 520 }: { stocks: Stock[]; horizon: Horizon; mode: Mode; height?: number }) {
  const { tx, lang } = useLang();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ s: Stock; x: number; y: number } | null>(null);

  const root = useMemo(() => {
    const bySector = new Map<string, Stock[]>();
    for (const s of stocks) {
      if (!s.market_cap) continue;
      const k = s.sector ?? "Other";
      bySector.set(k, [...(bySector.get(k) ?? []), s]);
    }
    const data = { name: "root", children: [...bySector.entries()].map(([name, list]) => ({ name, children: list.map((s) => ({ name: s.symbol, s, value: Math.sqrt(s.market_cap!) })) })) };
    type Node = { name: string; s?: Stock; value?: number; children?: Node[] };
    const h = hierarchy<Node>(data as Node).sum((d) => d.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<Node>().tile(treemapSquarify.ratio(1.2)).size([Math.max(1, w), height]).paddingOuter(3).paddingTop(18).paddingInner(2).round(true)(h);
  }, [stocks, w, height]);

  const color = (s: Stock) => {
    if (mode === "score") {
      const q = (s as unknown as Record<string, number>)[`q_${horizon}`];
      return VERDICT[verdictOf(q)].color;
    }
    const r = s.ret_1 ?? 0;
    const t = Math.max(-1, Math.min(1, r / 0.04));
    return t >= 0 ? `rgba(57,135,229,${0.18 + 0.75 * t})` : `rgba(230,103,103,${0.18 + 0.75 * -t})`;
  };
  const alpha = (s: Stock) => {
    if (mode !== "score") return 1;
    const q = (s as unknown as Record<string, number>)[`q_${horizon}`] ?? 0.5;
    return 0.35 + Math.abs(q - 0.5) * 1.3;
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerLeave={() => setHover(null)}>
          {root.children?.map((sec) => (
            <g key={sec.data.name}>
              <rect x={sec.x0} y={sec.y0} width={sec.x1 - sec.x0} height={sec.y1 - sec.y0} rx={6} fill="#0c1320" stroke="rgb(148 163 184 / 0.14)" />
              {sec.x1 - sec.x0 > 60 && (
                <text x={sec.x0 + 6} y={sec.y0 + 13} fontSize={11} fill="#aab5c7" fontWeight={500}>
                  {(lang === "id" ? SECTOR_ID[sec.data.name] ?? sec.data.name : sec.data.name).slice(0, Math.floor((sec.x1 - sec.x0) / 6.5))}
                </text>
              )}
              {sec.children?.map((leaf) => {
                const s = leaf.data.s!;
                const tw = leaf.x1 - leaf.x0;
                const th = leaf.y1 - leaf.y0;
                return (
                  <Link key={s.symbol} href={`/saham/${s.symbol}/`}>
                    <g onPointerEnter={() => setHover({ s, x: (leaf.x0 + leaf.x1) / 2, y: leaf.y0 })}>
                      <rect
                        x={leaf.x0}
                        y={leaf.y0}
                        width={tw}
                        height={th}
                        rx={3}
                        fill={color(s)}
                        fillOpacity={alpha(s)}
                        stroke={hover?.s.symbol === s.symbol ? "#e9eef6" : "transparent"}
                        strokeWidth={1.5}
                        style={{ transition: "fill 300ms, fill-opacity 300ms" }}
                      />
                      {tw > 34 && th > 18 && (
                        <text x={leaf.x0 + tw / 2} y={leaf.y0 + th / 2 - (th > 34 ? 6 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(14, Math.max(9.5, tw / 5))} fontWeight={600} fill="#f4f7fb">
                          {s.symbol}
                        </text>
                      )}
                      {tw > 40 && th > 34 && (
                        <text x={leaf.x0 + tw / 2} y={leaf.y0 + th / 2 + 9} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#e9eef6" fillOpacity={0.85} className="num">
                          {mode === "score" ? Math.round(((s as unknown as Record<string, number>)[`conf_${horizon}`] ?? 0.5) * 100) : signed((s.ret_1 ?? 0) * 100, 1, "%")}
                        </text>
                      )}
                    </g>
                  </Link>
                );
              })}
            </g>
          ))}
        </svg>
      )}
      {hover && (
        <Tooltip x={hover.x} y={hover.y} show>
          <div className="font-semibold text-ink">{hover.s.symbol}</div>
          <div className="max-w-48 truncate text-muted">{hover.s.name}</div>
          <div className="mt-1">
            {tx({ id: "Skor", en: "Score" })}{" "}
            <span className="num text-ink">{Math.round(((hover.s as unknown as Record<string, number>)[`conf_${horizon}`] ?? 0.5) * 100)}/100</span>
            {" · "}
            <span className={VERDICT[verdictOf((hover.s as unknown as Record<string, number>)[`q_${horizon}`])].text}>
              {tx(VERDICT[verdictOf((hover.s as unknown as Record<string, number>)[`q_${horizon}`])].label)}
            </span>
          </div>
          <div>
            {tx({ id: "Hari ini", en: "Today" })} <span className={`num ${(hover.s.ret_1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((hover.s.ret_1 ?? 0) * 100, 1, "%")}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
