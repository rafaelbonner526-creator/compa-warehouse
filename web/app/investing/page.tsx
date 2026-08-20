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
  actions: Row[];
  bands: Row[];
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

// Dollar amounts round to whole; percentages keep their decimal. "$6,343.7" is
// not a number anyone writes.
function fmt(v: number, unit: string): string {
  if (unit === "$") return `$${Math.round(v).toLocaleString("en-US")}`;
  return `${v}${unit}`;
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
  // Band checks must use the ACTIVE-account split, not the all-account blend.
  // mart_portfolio_signals reports combined; the 50-55% band is defined on Active.
  // Showing 54.0% against an Active band was two different numbers under one label.
  const active = d.bands.find((b) => String(b.scope) === "Active");
  const usPct = active ? Number(active.us_pct) : Number(s.us_equity_pct);
  const intlPct = active ? Number(active.intl_pct) : Number(s.intl_equity_pct);
  const bandMin = active ? Number(active.band_min) : 50;
  const bandMax = active ? Number(active.band_max) : 55;
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

  // Actions come from mart_portfolio_actions so the rules live in ONE place and
  // cannot drift from the Market tab. The old inline list hardcoded a 50-65% band
  // that had already been tightened to 50-55%.
  const acts = d.actions.map((a) => ({
    status: String(a.status),
    severity: Number(a.severity),
    area: String(a.area),
    title: String(a.title),
    detail: String(a.detail),
    current: Number(a.current_value),
    target: Number(a.target_value),
    unit: String(a.unit),
  }));
  const todo = acts.filter((a) => a.status === "act");
  const passing = acts.filter((a) => a.status !== "act");
  const smallestStd = positions.filter((p) => p.sleeve === "standard").sort((a, b) => a.pct - b.pct)[0];

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
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-zinc-300">Do this next</span>
          <span className="text-xs text-zinc-500">
            {todo.length} to act on · {passing.length} rules passing
          </span>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          Every rule below comes from your written thesis, checked against live holdings. Ranked by
          urgency: act now, then the quarterly rebalance, then watch.
        </p>

        {todo.length === 0 && (
          <p className="text-sm text-emerald-400">
            Every framework rule passes. Keep contributing, change nothing.
          </p>
        )}

        <ul className="space-y-3">
          {todo.map((a, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: a.severity === 1 ? RED : a.severity === 2 ? AMBER : ACCENT }}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium text-zinc-200">{a.title}</span>
                  <span className="text-xs tabular-nums text-zinc-500">
                    now {fmt(a.current, a.unit)}
                    {" · target "}
                    {fmt(a.target, a.unit)}
                  </span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                    {a.severity === 1 ? "now" : a.severity === 2 ? "rebalance" : "watch"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{a.detail}</p>
                {a.title === "Consolidate standard positions" && smallestStd && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Smallest standard position is{" "}
                    <strong className="text-zinc-400">{smallestStd.ticker}</strong> at {smallestStd.pct}%.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {passing.length > 0 && (
          <details className="mt-4 border-t border-zinc-800 pt-3">
            <summary className="cursor-pointer text-xs text-zinc-500">
              {passing.length} rules currently passing
            </summary>
            <ul className="mt-2 space-y-1">
              {passing.map((a, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-xs text-zinc-500">
                  <span>✓ {a.title}</span>
                  <span className="tabular-nums">{fmt(a.current, a.unit)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="mt-4 border-t border-zinc-800 pt-3 text-sm leading-relaxed text-zinc-400">{marketNote}</p>
      </Card>

      {/* band by scope */}
      <Card className="mt-3">
        <div className="mb-2 text-sm font-medium text-zinc-300">US / International by account</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="pb-2 pr-4 font-medium">Scope</th>
                <th className="pb-2 pr-4 text-right font-medium">Equity</th>
                <th className="pb-2 pr-4 text-right font-medium">US</th>
                <th className="pb-2 pr-4 text-right font-medium">Intl</th>
                <th className="pb-2 font-medium">vs band</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {d.bands.map((b) => (
                <tr key={String(b.scope)} className="border-t border-zinc-800">
                  <td className="py-2 pr-4 font-medium">{String(b.scope)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">
                    ${Number(b.equity_value).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{Number(b.us_pct)}%</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">{Number(b.intl_pct)}%</td>
                  <td className="py-2">
                    {b.in_alto_band ? (
                      <span className="text-emerald-400">in band</span>
                    ) : (
                      <span className="text-amber-400">
                        {Number(b.pct_over_ceiling) > 0
                          ? `${Number(b.pct_over_ceiling)}pp over`
                          : "below floor"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          The {bandMin}-{bandMax}% band applies to the Active account. Combined includes Acorns and the
          Roth, so it reads differently and is not what the rule is judged on.
        </p>
      </Card>

      {/* signals */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Signal label="US equity (Active)" value={`${usPct}%`} target={`${bandMin}-${bandMax}%`} ok={usPct >= bandMin && usPct <= bandMax} />
        <Signal label="Intl equity (Active)" value={`${intlPct}%`} target={`${100 - bandMax}-${100 - bandMin}%`} ok={intlPct >= 100 - bandMax && intlPct <= 100 - bandMin} />
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
