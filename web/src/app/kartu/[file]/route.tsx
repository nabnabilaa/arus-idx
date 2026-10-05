import { ImageResponse } from "next/og";
import { ANOMALY_Z, anomalyCard, chainCard, N_CHAIN_CARDS, WEEKLY_CARD } from "@/lib/cards";
import { bundle, series } from "@/lib/data";
import { insiderBook } from "@/lib/insider";
import { weeklyRecap } from "@/lib/weekly";
import type { InsiderChain, Stock } from "@/lib/types";

export const dynamic = "force-static";

const W = 1080;
const H = 1350;
const INK = "#e9eef6";
const INK2 = "#aab5c7";
const MUTED = "#75839a";
const ARUS = "#5cc8ff";
const UP = "#5cc8ff";
const DOWN = "#e66767";
const GREEN = "#7fd4a8";
const LINE = "#1f2a3c";

const strongest = (s: Stock) => Math.max(Math.abs(s.z_foreign ?? 0), Math.abs(s.z_volume ?? 0), Math.abs(s.z_return ?? 0));
const anomalies = () => bundle.ranking.filter((s) => strongest(s) >= ANOMALY_Z);
const chains = () => insiderBook.chains.slice(0, N_CHAIN_CARDS);

export function generateStaticParams() {
  return [
    ...anomalies().map((s) => ({ file: anomalyCard(s.symbol) })),
    ...chains().map((c) => ({ file: chainCard(c) })),
    { file: WEEKLY_CARD },
  ];
}

const pctTxt = (x: number | null | undefined, d = 1) =>
  x == null || !Number.isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(d).replace(".", ",")}%`;
const rp = (x: number | null | undefined) => {
  if (x == null || !Number.isFinite(x)) return "–";
  const a = Math.abs(x);
  const sign = x < 0 ? "−" : "";
  const f = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: v >= 100 ? 0 : 1 });
  if (a >= 1e12) return `${sign}Rp${f(a / 1e12)} T`;
  if (a >= 1e9) return `${sign}Rp${f(a / 1e9)} M`;
  if (a >= 1e6) return `${sign}Rp${f(a / 1e6)} jt`;
  return `${sign}Rp${f(a)}`;
};
const px = (x: number | null | undefined) => (x == null ? "–" : x.toLocaleString("id-ID", { maximumFractionDigits: 0 }));
const dLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function Frame({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: 64, background: "#070b14", color: INK, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: ARUS }} />
          <div style={{ fontSize: 38, fontWeight: 700, color: ARUS }}>Arus</div>
        </div>
        <div style={{ fontSize: 24, color: MUTED }}>{`Data ${dLabel(bundle.meta.as_of)}`}</div>
      </div>
      <div style={{ display: "flex", marginTop: 44, padding: "10px 22px", border: `3px solid ${ARUS}`, borderRadius: 16, alignSelf: "flex-start", fontSize: 30, fontWeight: 700, letterSpacing: 2, color: ARUS }}>
        {tag}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 28 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${LINE}`, paddingTop: 24, fontSize: 22, color: MUTED }}>
        <div>arus-idx.vercel.app</div>
        <div>Data: Sectors API & BEI · Bukan nasihat keuangan</div>
      </div>
    </div>
  );
}

function Tile({ label, value, color = INK, note }: { label: string; value: string; color?: string; note?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 24px", border: `2px solid ${LINE}`, borderRadius: 20, background: "#0c1320" }}>
      <div style={{ fontSize: 22, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
      {note ? <div style={{ fontSize: 20, color: MUTED, marginTop: 4 }}>{note}</div> : null}
    </div>
  );
}

function AnomalyCard({ s }: { s: Stock }) {
  const z = { foreign: s.z_foreign ?? 0, volume: s.z_volume ?? 0, ret: s.z_return ?? 0 };
  const top = [
    { k: "foreign", v: Math.abs(z.foreign), tag: z.foreign > 0 ? "ASING BORONG" : "ASING JUAL BESAR" },
    { k: "volume", v: z.volume, tag: "VOLUME MELONJAK" },
    { k: "ret", v: Math.abs(z.ret), tag: z.ret > 0 ? "HARGA NAIK TAJAM" : "HARGA TURUN TAJAM" },
  ].sort((a, b) => b.v - a.v)[0];
  const line =
    top.k === "foreign"
      ? `Asing ${(s.ff_today ?? 0) >= 0 ? "beli" : "jual"} bersih ${rp(Math.abs(s.ff_today ?? 0))}, biasanya ±${rp(s.ff_typical)} sehari`
      : top.k === "volume"
        ? `Volume ${(s.vol_mult ?? 0).toFixed(1).replace(".", ",")}× dari biasanya`
        : `Harga ${pctTxt(s.ret_1)}, biasanya ±${((s.ret_typical ?? 0) * 100).toFixed(1).replace(".", ",")}% sehari`;
  const histKey = top.k === "foreign" ? (z.foreign > 0 ? "foreign_up" : "foreign_down") : top.k === "volume" ? "volume_up" : z.ret > 0 ? "return_up" : "return_down";
  const h = bundle.anomalyHistory?.[histKey as keyof typeof bundle.anomalyHistory];
  const c = series[s.symbol];
  const n = c?.c.length ?? 0;
  const bars = c ? c.v.slice(-10).map((v, i) => ({ v: (v ?? 0) * (c.c[n - 10 + i] ?? 0), d: c.date[n - 10 + i] })) : [];
  const max = Math.max(...bars.map((b) => b.v), 1);
  return (
    <Frame tag={top.tag}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
        <div style={{ fontSize: 140, fontWeight: 700, lineHeight: 1 }}>{s.symbol}</div>
        <div style={{ fontSize: 56 }}>{px(s.price)}</div>
        <div style={{ fontSize: 44, color: (s.ret_1 ?? 0) >= 0 ? UP : DOWN }}>{pctTxt(s.ret_1, 2)}</div>
      </div>
      <div style={{ fontSize: 28, color: INK2, marginTop: 10 }}>{(s.name ?? "").replace(/^PT\.? /, "")}</div>
      <div style={{ fontSize: 34, color: INK, marginTop: 30, lineHeight: 1.3 }}>{line}</div>
      {bars.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34, padding: 26, border: `2px solid ${LINE}`, borderRadius: 20, background: "#0c1320" }}>
          <div style={{ fontSize: 22, color: MUTED }}>Nilai transaksi 10 hari terakhir</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 220, marginTop: 18 }}>
            {bars.map((b, i) => (
              <div key={b.d} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div style={{ width: "100%", height: Math.max(4, (b.v / max) * 200), borderRadius: 8, background: i === bars.length - 1 ? ARUS : "#26334a" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: MUTED, marginTop: 10 }}>
            <div>{dLabel(bars[0].d)}</div>
            <div style={{ color: ARUS }}>{`Hari ini ${rp(bars[bars.length - 1].v)}`}</div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 18, marginTop: 26 }}>
        <Tile label="5 hari" value={pctTxt(s.ret_5)} color={(s.ret_5 ?? 0) >= 0 ? UP : DOWN} />
        <Tile label="1 bulan" value={pctTxt(s.ret_20)} color={(s.ret_20 ?? 0) >= 0 ? UP : DOWN} />
        <Tile label="Asing sebulan" value={rp(s.ff_net_20)} color={(s.ff_net_20 ?? 0) >= 0 ? UP : DOWN} />
      </div>
      {h?.beat5 != null && (
        <div style={{ fontSize: 26, color: INK2, marginTop: 28 }}>{`Sesudah kejadian serupa: unggul ${Math.round(h.beat5 * 100)} dari 100 kali dalam 5 hari (${h.n5.toLocaleString("id-ID")} kejadian)`}</div>
      )}
    </Frame>
  );
}

function ChainCardImage({ c }: { c: InsiderChain }) {
  const path = insiderBook.paths[c.s];
  const buy = c.side === "buy";
  const name = insiderBook.stocks[c.s]?.name ?? "";
  const CW = 896;
  const CH = 330;
  let chart: React.ReactNode = null;
  if (path && path.c.length > 1) {
    const pts = c.trades.filter((t) => t.d >= path.d[0]);
    const ys = [...path.c, ...pts.map((t) => t.px)];
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const x = (i: number) => 10 + (i / (path.c.length - 1)) * (CW - 20);
    const y = (v: number) => (hi === lo ? CH / 2 : 12 + (1 - (v - lo) / (hi - lo)) * (CH - 24));
    const idx = (d: string) => {
      const i = path.d.findIndex((p) => p >= d);
      return i < 0 ? path.d.length - 1 : i;
    };
    const maxSh = Math.max(...pts.map((t) => t.sh), 1);
    const d = path.c.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    chart = (
      <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`}>
        <path d={d} fill="none" stroke={ARUS} strokeWidth={4} />
        {pts.map((t, i) => (
          <circle key={i} cx={x(idx(t.d))} cy={y(t.px)} r={7 + 9 * Math.sqrt(t.sh / maxSh)} fill={buy ? GREEN : DOWN} stroke="#070b14" strokeWidth={3} />
        ))}
      </svg>
    );
  }
  return (
    <Frame tag={buy ? "RANTAI BELI ORANG DALAM" : "RANTAI JUAL ORANG DALAM"}>
      <div style={{ fontSize: 30, color: INK2 }}>{`${c.s} · ${name.replace(/^PT\.? /, "")}`}</div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 64, fontWeight: 700, lineHeight: 1.12, marginTop: 14 }}>
        <div>{c.holder}</div>
        <div style={{ color: buy ? GREEN : DOWN }}>{`${buy ? "membeli" : "menjual"} ${c.n} kali`}</div>
      </div>
      <div style={{ fontSize: 26, color: MUTED, marginTop: 12 }}>{`${dLabel(c.first.slice(0, 10))} – ${dLabel(c.last.slice(0, 10))}`}</div>
      {chart && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, padding: 24, border: `2px solid ${LINE}`, borderRadius: 20, background: "#0c1320" }}>
          {chart}
          <div style={{ fontSize: 20, color: MUTED, marginTop: 8 }}>Garis: harga saham · titik: hari transaksi, besarnya sesuai jumlah saham</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 18, marginTop: 26 }}>
        <Tile label="Total" value={rp(c.val)} />
        <Tile label="Harga rata-rata" value={px(c.avg)} note={c.vs != null ? `Kini ${pctTxt(c.vs)} dari rata-rata` : undefined} />
        <Tile label="Kepemilikan" value={c.pa != null ? `${c.pa.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%` : "–"} note={c.pb != null && c.pa != null ? `${c.pa - c.pb >= 0 ? "+" : "−"}${Math.abs(c.pa - c.pb).toFixed(2).replace(".", ",")} poin` : undefined} />
      </div>
    </Frame>
  );
}

function WeeklyCard() {
  const w = weeklyRecap;
  const st = w.stats;
  return (
    <Frame tag="REKAP PEKAN">
      <div style={{ fontSize: 34, color: INK2 }}>{`${dLabel(w.from)} – ${dLabel(w.to)}`}</div>
      <div style={{ display: "flex", gap: 18, marginTop: 24 }}>
        <Tile label="IHSG" value={pctTxt(st.ihsg)} color={(st.ihsg ?? 0) >= 0 ? UP : DOWN} />
        <Tile label="Naik : turun" value={`${st.up} : ${st.down}`} color={st.up >= st.down ? UP : DOWN} />
        <Tile label="Asing bersih" value={rp(st.foreign)} color={st.foreign >= 0 ? UP : DOWN} />
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 24 }}>
        {[
          { t: "Naik paling tinggi", rows: w.gainers.slice(0, 4), color: UP },
          { t: "Turun paling dalam", rows: w.losers.slice(0, 4), color: DOWN },
        ].map((col) => (
          <div key={col.t} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 24px", border: `2px solid ${LINE}`, borderRadius: 20, background: "#0c1320" }}>
            <div style={{ fontSize: 22, color: MUTED }}>{col.t}</div>
            {col.rows.map((m) => (
              <div key={m.s} style={{ display: "flex", justifyContent: "space-between", fontSize: 32, marginTop: 12 }}>
                <div style={{ fontWeight: 700 }}>{m.s}</div>
                <div style={{ color: col.color }}>{pctTxt(m.ret)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
        {[
          { t: "Paling diborong asing", rows: w.foreign.buy.slice(0, 3), color: UP },
          { t: "Paling dilepas asing", rows: w.foreign.sell.slice(0, 3), color: DOWN },
        ].map((col) => (
          <div key={col.t} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 24px", border: `2px solid ${LINE}`, borderRadius: 20, background: "#0c1320" }}>
            <div style={{ fontSize: 22, color: MUTED }}>{col.t}</div>
            {col.rows.map((m) => (
              <div key={m.s} style={{ display: "flex", justifyContent: "space-between", fontSize: 30, marginTop: 10 }}>
                <div style={{ fontWeight: 700 }}>{m.s}</div>
                <div style={{ color: col.color }}>{rp(m.net)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 24, gap: 10 }}>
        {w.reads.pos.slice(0, 2).map((r, i) => (
          <div key={`p${i}`} style={{ display: "flex", fontSize: 26, color: GREEN }}>{`+  ${r.id}`}</div>
        ))}
        {w.reads.neg.slice(0, 2).map((r, i) => (
          <div key={`n${i}`} style={{ display: "flex", fontSize: 26, color: "#f0a3a3" }}>{`!  ${r.id}`}</div>
        ))}
      </div>
    </Frame>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  let node: React.ReactNode = null;
  if (file === WEEKLY_CARD) node = <WeeklyCard />;
  else if (file.startsWith("tak-biasa-")) {
    const s = bundle.ranking.find((r) => anomalyCard(r.symbol) === file);
    if (s) node = <AnomalyCard s={s} />;
  } else if (file.startsWith("orang-dalam-")) {
    const c = chains().find((x) => chainCard(x) === file);
    if (c) node = <ChainCardImage c={c} />;
  }
  if (!node) return new Response("Not found", { status: 404 });
  return new ImageResponse(node as React.ReactElement, { width: W, height: H });
}
