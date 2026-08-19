"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GREEN = "#34d399";
const RED = "#f87171";
const AMBER = "#fbbf24";
const ACCENT = "#818cf8";

type Row = Record<string, string | number | boolean | null>;
type Data = {
  signals: Row;
  allocation: Row[];
  positions: Row[];
  regime: Row | null;
  refreshed_at: string | null;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>{children}</div>
  );
}

function Signal({ label, value, target, ok }: { label: string; value: string; target: string; ok: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: ok ? GREEN : RED }} />
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: ok ? "#fafafa" : RED }}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">target {target}</div>
    </Card>
  );
}

type Action = { level: "high" | "med" | "ok"; text: string };
const LEVEL_COLOR = { high: RED, med: AMBER, ok: GREEN };

export default function Portfolio() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/investing")
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setD(j)))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <main className="p-8 text-red-400">Error: {err}</main>;
  if (!d) return <main className="p-8 text-zinc-500">Loading…</main>;

  const s = d.signals;
  const usPct = Number(s.us_equity_pct);
  const intlPct = Number(s.intl_equity_pct);
  const bondPct = Number(s.bond_pct);
  const vymiPct = Number(s.vymi_pct_active);
  const dryPct = Number(s.dry_powder_pct);
  const stdPos = Number(s.standard_positions);
  const usAlloc = d.allocation.find((a) => String(a.region) === "US")?.pct ?? 0;

  const positions = d.positions.map((p) => ({
    ticker: p.ticker ? String(p.ticker) : "—",
    sleeve: String(p.sleeve),
    value: Number(p.value),
    pct: Number(p.pct_of_active),
    cap: p.cap_pct ? Number(p.cap_pct) : null,
    over: Boolean(p.over_cap),
  }));

  // sleeve breakdown for the chart
  const bySleeve: Record<string, number> = {};
  positions.forEach((p) => (bySleeve[p.sleeve] = (bySleeve[p.sleeve] ?? 0) + p.value));
  const sleeves = Object.entries(bySleeve).map(([sleeve, value]) => ({ sleeve, value: Math.round(value) }));

  // regime
  const growth = d.regime ? Number(d.regime.growth_yoy) : 0;
  const infl = d.regime ? Number(d.regime.inflation_yoy) : 0;
  const reflation = growth > 0.5 && infl > 2.5;

  // --- next best actions (framework-grounded, not advice) ---
  const actions: Action[] = [];
  const smallestStd = positions.filter((p) => p.sleeve === "standard").sort((a, b) => a.pct - b.pct)[0];
  if (stdPos > 7 && smallestStd)
    actions.push({ level: "high", text: `Consolidate: ${stdPos} standard positions vs your 5-7 limit. Trim or merge the smallest (${smallestStd.ticker} at ${smallestStd.pct}%).` });
  positions.filter((p) => p.over).forEach((p) =>
    actions.push({ level: "high", text: `Trim ${p.ticker}: ${p.pct}% exceeds its ${p.cap}% cap.` }));
  if (bondPct > 0) actions.push({ level: "high", text: `Sell bonds: ${bondPct}% vs your 0% framework target.` });
  if (usPct > 65) actions.push({ level: "med", text: `US equity ${usPct}% is above your 50-65% band, add international on the next contribution.` });
  if (usPct < 50) actions.push({ level: "med", text: `US equity ${usPct}% is below your 50-65% band, add US on the next contribution.` });
  if (vymiPct < 25) actions.push({ level: "med", text: `VYMI ${vymiPct}% is below your 25-35% target, build it via contributions.` });
  if (vymiPct > 35) actions.push({ level: "med", text: `VYMI ${vymiPct}% exceeds 35%, trim on next rebalance.` });
  if (actions.length === 0)
    actions.push({ level: "ok", text: "Portfolio is aligned with your framework. No rebalancing needed, keep contributing." });

  const marketNote = reflation
    ? `The regime is reflationary (growth +${growth}%, inflation +${infl}%). Your international tilt (${intlPct}%), dividend/value exposure (VYMI ${vymiPct}%), and gold hedge fit this backdrop; expensive US growth is the main risk to watch.`
    : `Growth +${growth}%, inflation +${infl}%. Keep positioning aligned to your framework bands; let contributions do the rebalancing.`;

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
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        {refreshed && <span className="text-xs text-zinc-500">Last refreshed {refreshed} ET</span>}
      </div>
      <p className="mt-1 text-sm text-zinc-500">Your holdings vs your ALTO framework. Signals, not advice. Nothing executes trades.</p>

      {/* next best actions */}
      <Card className="mt-6">
        <div className="mb-3 text-sm font-medium text-zinc-300">Next best actions</div>
        <ul className="space-y-2.5">
          {actions.map((a, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: LEVEL_COLOR[a.level] }} />
              <span className="text-zinc-300">{a.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-zinc-800 pt-3 text-sm leading-relaxed text-zinc-400">{marketNote}</p>
      </Card>

      {/* signals */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Signal label="US equity" value={`${usPct}%`} target="50-65%" ok={usPct >= 50 && usPct <= 65} />
        <Signal label="Intl equity" value={`${intlPct}%`} target="35-50%" ok={intlPct >= 35 && intlPct <= 50} />
        <Signal label="Bonds" value={`${bondPct}%`} target="0%" ok={bondPct === 0} />
        <Signal label="VYMI (Active)" value={`${vymiPct}%`} target="25-35%" ok={vymiPct >= 25 && vymiPct <= 35} />
        <Signal label="Standard positions" value={`${stdPos}`} target="5-7" ok={stdPos >= 5 && stdPos <= 7} />
        <Signal label="Dry powder" value={`${dryPct}%`} target="flexible" ok={true} />
      </div>

      {/* allocation: region + sleeve */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-zinc-400">Geographic split (equity)</span>
            <span className="text-zinc-300">US {usAlloc}% · Intl {100 - Number(usAlloc)}%</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            <div style={{ width: `${usAlloc}%`, background: GREEN }} />
            <div style={{ width: `${100 - Number(usAlloc)}%`, background: ACCENT }} />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: GREEN }} /> US</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: ACCENT }} /> International</span>
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">Active by sleeve</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sleeves} layout="vertical" margin={{ left: 30, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="sleeve" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={90} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }} formatter={(v) => `$${Number(v).toLocaleString()}`} cursor={{ fill: "#27272a55" }} />
              <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* positions */}
      <Card className="mt-3">
        <div className="mb-3 text-sm font-medium text-zinc-300">Active positions vs sleeve caps</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="py-1 pr-4">Ticker</th>
                <th className="py-1 pr-4">Sleeve</th>
                <th className="py-1 pr-4">Value</th>
                <th className="py-1 pr-4">% of Active</th>
                <th className="py-1">Cap</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {positions.map((p, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="py-1.5 pr-4">{p.ticker}</td>
                  <td className="py-1.5 pr-4 text-zinc-400">{p.sleeve}</td>
                  <td className="py-1.5 pr-4">${p.value.toLocaleString()}</td>
                  <td className="py-1.5 pr-4" style={{ color: p.over ? RED : undefined }}>{p.pct}%</td>
                  <td className="py-1.5">{p.cap ? <span style={{ color: p.over ? RED : "#71717a" }}>{p.over ? "over" : "≤"} {p.cap}%</span> : <span className="text-zinc-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
