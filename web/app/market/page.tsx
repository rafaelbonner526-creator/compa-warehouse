"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GREEN = "#34d399";
const ACCENT = "#818cf8";

type Row = Record<string, string | number | null>;
type Data = {
  indicators: Row[];
  regime: Row | null;
  history: Row[];
  refreshed_at: string | null;
};

const NAMES: Record<string, string> = {
  oil_wti: "Oil (WTI)",
  cpi: "CPI inflation",
  commodities: "Commodities (PPI)",
  fed_funds: "Fed funds rate",
  bond_10y: "10Y Treasury yield",
  yield_curve_10y2y: "Yield curve (10Y-2Y)",
  industrial_production: "Industrial production",
};

const BLURBS: Record<string, string> = {
  oil_wti: "Crude oil. Rising oil feeds inflation and squeezes consumers; falling oil eases both.",
  cpi: "Consumer prices, the headline inflation gauge the Fed tries to hold near 2%.",
  commodities: "Producer prices for raw goods, an early read on inflation still in the pipeline.",
  fed_funds: "The Fed's policy rate. Higher = tighter money (a headwind for stocks and bonds); cuts stimulate.",
  bond_10y: "The benchmark 'risk-free' rate. Rising yields pressure stock valuations, especially growth stocks.",
  yield_curve_10y2y: "10-year minus 2-year yield. Negative (inverted) has preceded most recessions; positive and widening signals expansion.",
  industrial_production: "Factory output, a real-economy growth gauge. Rising means expansion.",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>{children}</div>
  );
}

function regimeBlurb(q: string): string {
  switch (q) {
    case "Reflation / late-cycle":
      return "Growth is still positive while inflation runs hot. This late-cycle mix historically favors real assets (commodities, gold), value and international stocks over expensive growth, and rewards keeping some cash ready.";
    case "Goldilocks / expansion":
      return "Growth positive, inflation cool, the friendliest backdrop for stocks. Broad equity exposure tends to do well.";
    case "Stagflation":
      return "Weak growth with high inflation, the toughest mix. Favors inflation hedges (commodities, gold), quality, and cash; expensive growth stocks suffer.";
    default:
      return "Growth and inflation both fading. Favors quality and defensives; risk assets are vulnerable.";
  }
}

export default function Market() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/market")
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setD(j)))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <main className="p-8 text-red-400">Error: {err}</main>;
  if (!d) return <main className="p-8 text-zinc-500">Loading…</main>;

  const growth = d.regime ? Number(d.regime.growth_yoy) : 0;
  const infl = d.regime ? Number(d.regime.inflation_yoy) : 0;
  const quadrant =
    growth > 0.5
      ? infl > 2.5
        ? "Reflation / late-cycle"
        : "Goldilocks / expansion"
      : infl > 2.5
        ? "Stagflation"
        : "Deflation / slowdown";

  const hist: Record<string, { d: string; v: number }[]> = {};
  for (const r of d.history) {
    const s = String(r.series);
    (hist[s] ||= []).push({ d: String(r.obs_date), v: Number(r.value) });
  }

  const ind = Object.fromEntries(d.indicators.map((r) => [String(r.series), r]));
  const bond = ind["bond_10y"];
  const others = d.indicators
    .filter((r) => String(r.series) !== "bond_10y")
    .map((r) => String(r.series));

  const refreshed = d.refreshed_at
    ? new Date(d.refreshed_at).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Market</h1>
        {refreshed && <span className="text-xs text-zinc-500">Last refreshed {refreshed} ET</span>}
      </div>
      <p className="mt-1 text-sm text-zinc-500">Macro signals from FRED. What the market backdrop is saying.</p>

      {/* regime */}
      <Card className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-400">Macro regime</span>
          <span className="text-xs text-zinc-500">growth {growth}% · inflation {infl}%</span>
        </div>
        <div className="mt-1 text-3xl font-semibold">{quadrant}</div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{regimeBlurb(quadrant)}</p>
      </Card>

      {/* 10Y treasury */}
      {bond && (
        <Card className="mt-3">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-medium text-zinc-300">{NAMES.bond_10y}</span>
            <span className="text-lg font-semibold">{Number(bond.latest_value)}%</span>
          </div>
          <p className="mb-3 text-xs text-zinc-500">{BLURBS.bond_10y}</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={hist["bond_10y"] ?? []} margin={{ left: -12, right: 8, top: 4 }}>
              <XAxis dataKey="d" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={50} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} width={36} domain={["auto", "auto"]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }} formatter={(v) => `${Number(v)}%`} />
              <Line type="monotone" dataKey="v" stroke={ACCENT} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* indicator sparklines */}
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {others.map((s) => {
          const r = ind[s];
          const dir = String(r.direction);
          return (
            <Card key={s}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-zinc-400">{NAMES[s] ?? s}</span>
                <span className="text-lg font-semibold">{Number(r.latest_value).toLocaleString()}</span>
              </div>
              <div className="text-xs text-zinc-500">
                {dir === "up" ? "▲" : dir === "down" ? "▼" : "—"} {Math.abs(Number(r.change_90d_pct))}% · 90d
              </div>
              <ResponsiveContainer width="100%" height={44}>
                <LineChart data={hist[s] ?? []}>
                  <Line type="monotone" dataKey="v" stroke={GREEN} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-1 text-xs leading-snug text-zinc-500">{BLURBS[s]}</p>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
