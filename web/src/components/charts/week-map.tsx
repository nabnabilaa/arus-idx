"use client";

import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Tooltip, useWidth } from "./kit";
import { idr, signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { IDX_SECTOR_EN } from "@/lib/weekly";

export type MapItem = { s: string; name: string | null; ret: number; fnet: number; val: number; sector: string | null };
export type MapMode = "price" | "foreign";

/** Diverging tile colour: blue up, red down, saturating at ±cap. */
export function tileColor(v: number, cap: number) {
  const t = Math.max(-1, Math.min(1, v / cap));
  return t >= 0 ? `rgba(57,135,229,${0.16 + 0.78 * t})` : `rgba(230,103,103,${0.16 + 0.78 * -t})`;
}

/** The week's market as tiles: size = value traded, colour = weekly move (or foreign net), grouped by sector. */
export function WeekMap({ items, mode, ranked, height = 560 }: { items: MapItem[]; mode: MapMode; ranked: Set<string>; height?: number }) {
  const { tx, lang } = useLang();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ it: MapItem; x: number; y: number } | null>(null);
  const fcap = useMemo(() => {
    const v = items.map((i) => Math.abs(i.fnet / Math.max(1, i.val))).sort((a, b) => a - b);
    return v[Math.floor(v.length * 0.9)] || 0.1;
  }, [items]);
  const colorOf = (it: MapItem) => (mode === "price" ? tileColor(it.ret, 0.08) : tileColor(it.fnet / Math.max(1, it.val), fcap));

  const root = useMemo(() => {
    const by = new Map<string, MapItem[]>();
    for (const it of items) by.set(it.sector ?? "–", [...(by.get(it.sector ?? "–") ?? []), it]);
    type Node = { name: string; it?: MapItem; value?: number; children?: Node[] };
    const data: Node = { name: "root", children: [...by.entries()].map(([name, list]) => ({ name, children: list.map((it) => ({ name: it.s, it, value: Math.sqrt(it.val) })) })) };
    const h = hierarchy<Node>(data).sum((d) => d.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<Node>().tile(treemapSquarify.ratio(1.25)).size([Math.max(1, w), height]).paddingOuter(3).paddingTop(18).paddingInner(2).round(true)(h);
  }, [items, w, height]);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerLeave={() => setHover(null)} role="img" aria-label={tx({ id: "Peta pasar sepekan", en: "Market map for the week" })}>
          {root.children?.map((sec) => (
            <g key={sec.data.name}>
              <rect x={sec.x0} y={sec.y0} width={sec.x1 - sec.x0} height={sec.y1 - sec.y0} rx={6} fill="#0c1320" stroke="rgb(148 163 184 / 0.14)" />
              {sec.x1 - sec.x0 > 60 && (
                <text x={sec.x0 + 6} y={sec.y0 + 13} fontSize={11} fill="#aab5c7" fontWeight={500}>
                  {(lang === "id" ? sec.data.name : IDX_SECTOR_EN[sec.data.name] ?? sec.data.name).slice(0, Math.floor((sec.x1 - sec.x0) / 6.4))}
                </text>
              )}
              {sec.children?.map((leaf) => {
                const it = leaf.data.it!;
                const tw = leaf.x1 - leaf.x0;
                const th = leaf.y1 - leaf.y0;
                const big = tw > 46 && th > 30;
                const tile = (
                  <g
                    onPointerMove={(e) => {
                      const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      setHover({ it, x: e.clientX - r.left, y: e.clientY - r.top });
                    }}
                  >
                    <rect x={leaf.x0} y={leaf.y0} width={tw} height={th} rx={3} fill={colorOf(it)} stroke={hover?.it.s === it.s ? "#e9eef6" : "transparent"} />
                    {big && (
                      <>
                        <text x={leaf.x0 + tw / 2} y={leaf.y0 + th / 2 - (th > 44 ? 4 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(15, Math.max(10, tw / 6))} fontWeight={600} fill="#e9eef6">
                          {it.s}
                        </text>
                        {th > 44 && (
                          <text x={leaf.x0 + tw / 2} y={leaf.y0 + th / 2 + 12} textAnchor="middle" dominantBaseline="middle" fontSize={10.5} fill="rgb(233 238 246 / 0.82)">
                            {mode === "price" ? signed(it.ret * 100, 1, "%") : idr(it.fnet, lang)}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                );
                return ranked.has(it.s) ? (
                  <Link key={it.s} href={`/saham/${it.s}/`}>
                    {tile}
                  </Link>
                ) : (
                  <g key={it.s}>{tile}</g>
                );
              })}
            </g>
          ))}
        </svg>
      )}
      {hover && (
        <Tooltip x={hover.x} y={hover.y} show>
          <div className="font-semibold text-ink">
            {hover.it.s} <span className="font-normal text-muted">{(hover.it.name ?? "").replace(/^PT\.? /, "").replace(/ Tbk\.?$/, "")}</span>
          </div>
          <div>
            {tx({ id: "Sepekan", en: "Week" })} <span className={`num ${hover.it.ret >= 0 ? "text-up" : "text-down"}`}>{signed(hover.it.ret * 100, 1, "%")}</span>
          </div>
          <div>
            {tx({ id: "Asing", en: "Foreign" })} <span className={`num ${hover.it.fnet >= 0 ? "text-up" : "text-down"}`}>{idr(hover.it.fnet, lang)}</span>
          </div>
          <div>
            {tx({ id: "Transaksi", en: "Traded" })} <span className="num text-ink">{idr(hover.it.val, lang)}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
