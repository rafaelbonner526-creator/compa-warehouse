"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GREEN = "#34d399";
const ACCENT = "#818cf8";
const AMBER = "#fbbf24";

type Row = Record<string, string | number | boolean | null>;
type Data = {
  indicators: Row[];
  regime: Row | null;
  history: Row[];
  allWeather: Row[];
  equilibrium: Row | null;
  bigCycle: Row[];
  propertyCycle: Row | null;
  evidenceBands: Row[];
  housePrices: Row[];
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
  corp_baa: "Baa corporate yield",
  capacity_utilization: "Capacity utilization",
  debt_to_gdp: "Federal debt / GDP",
  house_prices: "Home prices (Case-Shiller)",
};

const BLURBS: Record<string, string> = {
  oil_wti: "Crude oil. Rising oil feeds inflation and squeezes consumers; falling oil eases both.",
  cpi: "Consumer prices, the headline inflation gauge the Fed tries to hold near 2%.",
  commodities: "Producer prices for raw goods, an early read on inflation still in the pipeline.",
  fed_funds: "The Fed's policy rate. Higher = tighter money; cuts stimulate.",
  bond_10y: "The benchmark 'risk-free' rate. Rising yields pressure stock valuations.",
  yield_curve_10y2y: "10-year minus 2-year yield. Negative has preceded most recessions.",
  industrial_production: "Factory output, a real-economy growth gauge.",
  corp_baa: "Baa-rated corporate bond yield, the credit rung of the risk-premium stack.",
  capacity_utilization: "How much of industrial capacity is in use. Above its long-run average means overheating; below means slack.",
  debt_to_gdp: "Federal debt as a share of the economy. The long-term debt cycle in one number.",
  house_prices: "National home price index. Drives the 18-year property cycle read.",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>{children}</div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs leading-relaxed text-zinc-500">{children}</p>;
}

function regimeBlurb(q: string): string {
  switch (q) {
    case "Reflation / late-cycle":
      return "Growth is still positive while inflation runs hot. This late-cycle mix historically favors real assets, value and international over expensive growth.";
    case "Goldilocks / expansion":
      return "Growth positive, inflation cool, the friendliest backdrop for stocks.";
    case "Stagflation":
      return "Weak growth with high inflation, the toughest mix. Favors inflation hedges and quality.";
    case "Deflation / slowdown":
      return "Growth and inflation both fading. Favors quality and defensives; risk assets are vulnerable.";
    default:
      return "Not enough data to classify the regime.";
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

  const r = d.regime;
  const quadrant = r ? String(r.quadrant) : "Unknown";
  const awBox = r ? String(r.aw_box) : "unknown";
  const eq = d.equilibrium;
  const pc = d.propertyCycle;

  const hist: Record<string, { d: string; v: number }[]> = {};
  for (const h of d.history) {
    const s = String(h.series);
    (hist[s] ||= []).push({ d: String(h.obs_date), v: Number(h.value) });
  }

  const ind = Object.fromEntries(d.indicators.map((x) => [String(x.series), x]));
  const bond = ind["bond_10y"];
  const others = d.indicators
    .filter((x) => String(x.series) !== "bond_10y")
    .map((x) => String(x.series));

  const refreshed = d.refreshed_at
    ? new Date(d.refreshed_at).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  // property cycle chart data
  const troughDate = pc ? String(pc.trough_date) : null;
  const hp = d.housePrices.map((x) => ({ d: String(x.obs_date), v: Number(x.value) }));
  const troughPoint = hp.find((p) => p.d === troughDate);
  const yearsIn = pc ? Number(pc.years_since_trough) : 0;
  const pctComplete = pc ? Number(pc.cycle_pct_complete) : 0;

  const PHASES = [
    { label: "Recovery", from: 0, to: 7 },
    { label: "Mid-cycle slowdown", from: 7, to: 9 },
    { label: "Expansion", from: 9, to: 14 },
    { label: "Mania / peak", from: 14, to: 16 },
    { label: "Downturn", from: 16, to: 18 },
  ];

  return (
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Market</h1>
        {refreshed && <span className="text-xs text-zinc-500">Last refreshed {refreshed} ET</span>}
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Macro signals from FRED, read through Dalio&apos;s cycle frameworks.
      </p>

      <div className="mt-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200/80">
        <strong className="font-semibold text-amber-200">Read-only.</strong> These are signals, never
        verdicts, and never trade instructions. Per the governance stack, cycle reads inform the
        direction of the <em>pre-committed quarterly rebalance</em> and never justify a trade between
        rebalances. Research also finds that the more often you look at a portfolio, the less risk you
        take and the lower your returns. Looking more often than quarterly is the failure mode this
        page is designed against.
      </div>

      {/* ---------- regime ---------- */}
      <Card className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-400">Macro regime</span>
          <span className="text-xs text-zinc-500">
            growth {r ? String(r.growth_yoy) : "?"}% · inflation {r ? String(r.inflation_yoy) : "?"}%
          </span>
        </div>
        <div className="mt-1 text-3xl font-semibold">{quadrant}</div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{regimeBlurb(quadrant)}</p>
        {r && (
          <Note>
            Levels put us in <strong className="text-zinc-400">{quadrant}</strong>. Direction of travel
            is different and matters for the grid below: growth is{" "}
            <strong className="text-zinc-400">{String(r.growth_direction)}</strong> (
            {String(r.growth_yoy)}% now vs {String(r.growth_yoy_3m_ago)}% three months ago) and
            inflation is <strong className="text-zinc-400">{String(r.inflation_direction)}</strong> (
            {String(r.inflation_yoy)}% vs {String(r.inflation_yoy_3m_ago)}%). All Weather boxes are
            about change, not level.
          </Note>
        )}
      </Card>

      {/* ---------- all weather grid ---------- */}
      <h2 className="mt-8 text-lg font-semibold">All Weather coverage</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Four environments. Dalio&apos;s rule is to hold something that wins in each. Highlighted box is
        where the direction of travel currently points.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {d.allWeather.map((b) => {
          const isNow = String(b.box) === awBox;
          const byDesign = Boolean(b.by_design);
          const cov = String(b.coverage);
          const pct = Number(b.covering_pct);
          const tone = byDesign
            ? "text-zinc-500"
            : cov === "covered"
              ? "text-emerald-400"
              : cov === "thin"
                ? "text-amber-400"
                : "text-red-400";
          return (
            <div
              key={String(b.box)}
              className={`rounded-2xl border p-5 ${
                isNow
                  ? "border-indigo-500/70 bg-indigo-950/30 ring-1 ring-indigo-500/30"
                  : "border-zinc-800 bg-zinc-900/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-zinc-300">{String(b.box_label)}</span>
                {isNow && (
                  <span className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                    now
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-semibold ${tone}`}>{pct}%</span>
                <span className={`text-xs uppercase tracking-wide ${tone}`}>
                  {byDesign ? "by choice" : cov}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Wins here: {String(b.wins)}</p>
              {byDesign && (
                <p className="mt-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                  {String(b.by_design_reason)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <Note>
        Percentages are share of total portfolio in assets that historically win in that box, so they
        do not sum to 100: gold counts in both inflationary boxes. International equity counts as
        equity, not as an inflation hedge, because it is ~0.6 correlated with the rest of the equity
        book. Counting it twice would show diversification the portfolio does not have.
      </Note>

      {/* ---------- evidence bands ---------- */}
      <h2 className="mt-8 text-lg font-semibold">US / International vs the evidence</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Live split against the ALTO band (50-55% US) and the zone Cederburg et al. measure as
        near-costless (11-55% domestic).
      </p>
      <Card className="mt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="pb-2 pr-4 font-medium">Scope</th>
                <th className="pb-2 pr-4 text-right font-medium">Equity</th>
                <th className="pb-2 pr-4 text-right font-medium">US</th>
                <th className="pb-2 pr-4 text-right font-medium">Intl</th>
                <th className="pb-2 pr-4 font-medium">ALTO band</th>
                <th className="pb-2 font-medium">Evidence zone</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {d.evidenceBands.map((b) => (
                <tr key={String(b.scope)} className="border-t border-zinc-800">
                  <td className="py-2 pr-4 font-medium">{String(b.scope)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">
                    ${Number(b.equity_value).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{Number(b.us_pct)}%</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">
                    {Number(b.intl_pct)}%
                  </td>
                  <td className="py-2 pr-4">
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
                  <td className="py-2">
                    {b.in_evidence_zone ? (
                      <span className="text-emerald-400">inside</span>
                    ) : (
                      <span className="text-amber-400">outside</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          The band ceiling moved from 65% to 55% on 2026-08-18. Beyond 55% domestic, the paper&apos;s
          equivalent savings rate starts climbing above 10.50%. Correct any overshoot by routing new
          contributions to international, not by selling.
        </Note>
      </Card>

      {/* ---------- three equilibriums ---------- */}
      <h2 className="mt-8 text-lg font-semibold">The three equilibriums</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Dalio&apos;s check that the machine is in balance: debt vs income, capacity, and the
        risk-premium stack.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Card>
          <span className="text-sm text-zinc-400">Debt vs income</span>
          <div className="mt-1 text-3xl font-semibold">
            {eq?.debt_to_gdp != null ? `${Number(eq.debt_to_gdp)}%` : "—"}
          </div>
          <div className="text-xs text-zinc-500">
            federal debt / GDP
            {eq?.debt_to_gdp_chg_1y != null && (
              <> · {Number(eq.debt_to_gdp_chg_1y) >= 0 ? "+" : ""}
                {Number(eq.debt_to_gdp_chg_1y)}pp over 1y</>
            )}
          </div>
          <Note>
            Debt growing faster than income is the engine of the long-term debt cycle. This feeds the
            Big Cycle stage below.
          </Note>
        </Card>
        <Card>
          <span className="text-sm text-zinc-400">Capacity</span>
          <div className="mt-1 text-3xl font-semibold">
            {eq?.capacity_utilization != null ? `${Number(eq.capacity_utilization)}%` : "—"}
          </div>
          <div className="text-xs text-zinc-500">
            {eq?.capacity_gap != null ? (
              <>
                {Number(eq.capacity_gap) >= 0 ? "+" : ""}
                {Number(eq.capacity_gap)}pp vs long-run avg{" "}
                {eq?.capacity_longrun_avg != null && <>({Number(eq.capacity_longrun_avg)}%)</>}
              </>
            ) : (
              "—"
            )}
          </div>
          <Note>
            Above the long-run average means the economy is running hot and inflation pressure builds.
            Below means slack. Average is computed over {eq?.capacity_n_obs ? String(eq.capacity_n_obs) : "?"}{" "}
            monthly observations (~20 years).
          </Note>
        </Card>
        <Card>
          <span className="text-sm text-zinc-400">Risk-premium stack</span>
          <div className="mt-1 text-xl font-semibold capitalize">
            {eq?.stack_shape ? String(eq.stack_shape).replace("_", " ") : "—"}
          </div>
          <div className="mt-2 space-y-1 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span>Cash (fed funds)</span>
              <span className="tabular-nums">{eq?.cash_yield != null ? `${Number(eq.cash_yield)}%` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Treasuries (10Y)</span>
              <span className="tabular-nums">{eq?.bond_yield != null ? `${Number(eq.bond_yield)}%` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Credit (Baa corp)</span>
              <span className="tabular-nums">{eq?.credit_yield != null ? `${Number(eq.credit_yield)}%` : "—"}</span>
            </div>
          </div>
          <Note>
            Each rung must pay more than the one below it. An inversion signals tightening. The equity
            rung is <strong className="text-zinc-400">not measured</strong>: there is no free earnings
            yield series, and inventing one would be worse than leaving it out.
          </Note>
        </Card>
      </div>

      {/* ---------- big cycle ---------- */}
      <h2 className="mt-8 text-lg font-semibold">Dalio Big Cycle</h2>
      <p className="mt-1 text-sm text-zinc-500">
        The 50-75 year arc of a reserve-currency power. Position is derived from federal debt to GDP.
      </p>
      <Card className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-zinc-400">
            Debt / GDP{" "}
            <strong className="text-zinc-200">
              {eq?.debt_to_gdp != null ? `${Number(eq.debt_to_gdp)}%` : "—"}
            </strong>
          </span>
          {d.bigCycle[0]?.debasement_risk && (
            <span className="text-xs text-zinc-500">
              debasement risk:{" "}
              <strong
                className={
                  String(d.bigCycle[0].debasement_risk) === "high"
                    ? "text-red-400"
                    : String(d.bigCycle[0].debasement_risk) === "medium"
                      ? "text-amber-400"
                      : "text-emerald-400"
                }
              >
                {String(d.bigCycle[0].debasement_risk)}
              </strong>
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {d.bigCycle.map((s) => {
            const cur = Boolean(s.is_current);
            const unreachable = Number(s.stage_order) === 6;
            return (
              <div
                key={String(s.stage_order)}
                className={`rounded-xl border px-4 py-3 ${
                  cur
                    ? "border-indigo-500/70 bg-indigo-950/30"
                    : "border-zinc-800/70 bg-zinc-900/30"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className={`text-sm font-medium ${cur ? "text-indigo-200" : unreachable ? "text-zinc-600" : "text-zinc-400"}`}
                  >
                    {String(s.stage_order)}. {String(s.stage_name)}
                  </span>
                  <span className="text-[11px] tabular-nums text-zinc-500">
                    {unreachable
                      ? "not detectable from debt/GDP"
                      : `debt/GDP ${Number(s.debt_min)}–${Number(s.debt_max)}%`}
                  </span>
                </div>
                <p className={`mt-1 text-xs ${cur ? "text-zinc-300" : "text-zinc-600"}`}>
                  {String(s.description)}
                </p>
                {cur && (
                  <p className="mt-2 text-xs text-indigo-300/90">→ {String(s.implication)}</p>
                )}
              </div>
            );
          })}
        </div>
        <Note>
          Stage thresholds come from the existing empire-health-monitor definition so there is one
          stage model, not two that drift. This is a slow signal: it moves on a scale of years and is
          reviewed annually, not quarterly.
        </Note>
      </Card>

      {/* ---------- 18-year property cycle ---------- */}
      <h2 className="mt-8 text-lg font-semibold">18-year property cycle</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Fred Harrison / Phil Anderson land-cycle model, measured against real Case-Shiller prices.
      </p>
      <Card className="mt-3">
        {pc ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold">{String(pc.phase)}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Year {Number(pc.years_since_trough)} of 18 · {pctComplete}% through the model cycle
                </div>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <div>
                  trough located at{" "}
                  <strong className="text-zinc-300">{troughDate?.slice(0, 7)}</strong>
                </div>
                <div>prices +{Number(pc.pct_off_trough)}% since</div>
              </div>
            </div>

            {/* phase bar */}
            <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg border border-zinc-800">
              {PHASES.map((p) => {
                const active = yearsIn >= p.from && yearsIn < p.to;
                return (
                  <div
                    key={p.label}
                    style={{ width: `${((p.to - p.from) / 18) * 100}%` }}
                    className={`flex items-center justify-center border-r border-zinc-800 px-1 text-center text-[10px] leading-tight last:border-r-0 ${
                      active ? "bg-indigo-600/40 font-semibold text-indigo-100" : "bg-zinc-900/60 text-zinc-600"
                    }`}
                    title={`years ${p.from}-${p.to}`}
                  >
                    {p.label}
                  </div>
                );
              })}
            </div>
            <div className="relative mt-1 h-3">
              <div
                className="absolute top-0 -translate-x-1/2 text-[10px] text-indigo-300"
                style={{ left: `${Math.min(100, Math.max(0, pctComplete))}%` }}
              >
                ▲ now
              </div>
            </div>

            {/* price chart with trough marked */}
            <div className="mt-5">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={hp} margin={{ left: -12, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="hpFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AMBER} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="d"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    minTickGap={60}
                    tickFormatter={(v) => String(v).slice(0, 4)}
                  />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} width={40} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }}
                  />
                  <Area type="monotone" dataKey="v" stroke={AMBER} strokeWidth={2} fill="url(#hpFill)" />
                  {troughDate && <ReferenceLine x={troughDate} stroke={GREEN} strokeDasharray="3 3" />}
                  {troughPoint && (
                    <ReferenceDot x={troughPoint.d} y={troughPoint.v} r={4} fill={GREEN} stroke="none" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200/80">
              <strong className="font-semibold text-amber-200">Contested model, read it as an overlay.</strong>{" "}
              The trough date and elapsed years are <em>measured</em> from Case-Shiller. The 18-year
              length and the phase boundaries are <em>modeled</em>, from a heterodox framework with
              only a handful of observed cycles. It is not a forecast, and it is
              not a Warren Buffett model, which it is often miscredited as.
              {Boolean(pc.trough_at_edge) && (
                <>
                  {" "}
                  <strong className="text-red-300">
                    Warning: the located trough sits at the edge of the available data, so it may be a
                    window boundary rather than a real trough.
                  </strong>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">No home price data loaded.</p>
        )}
      </Card>

      {/* ---------- 10Y treasury ---------- */}
      <h2 className="mt-8 text-lg font-semibold">Indicators</h2>
      {bond && (
        <Card className="mt-3">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-medium text-zinc-300">{NAMES.bond_10y}</span>
            <span className="text-lg font-semibold">{Number(bond.latest_value)}%</span>
          </div>
          <p className="mb-3 text-xs text-zinc-500">{BLURBS.bond_10y}</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={hist["bond_10y"] ?? []} margin={{ left: -12, right: 8, top: 4 }}>
              <XAxis
                dataKey="d"
                tick={{ fill: "#71717a", fontSize: 11 }}
                minTickGap={50}
                tickFormatter={(v) => String(v).slice(5)}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                width={36}
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }}
                formatter={(v) => `${Number(v)}%`}
              />
              <Line type="monotone" dataKey="v" stroke={ACCENT} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {others.map((s) => {
          const x = ind[s];
          const dir = String(x.direction);
          return (
            <Card key={s}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-zinc-400">{NAMES[s] ?? s}</span>
                <span className="text-lg font-semibold">{Number(x.latest_value).toLocaleString()}</span>
              </div>
              <div className="text-xs text-zinc-500">
                {dir === "up" ? "▲" : dir === "down" ? "▼" : "—"} {Math.abs(Number(x.change_90d_pct))}% ·
                90d
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

      <p className="mt-8 text-xs leading-relaxed text-zinc-600">
        Reminder, from the same evidence base that sets the bands above: what did well is more
        expensive, not better. Rebalance toward the laggard inside the band. Do not chase.
      </p>
    </main>
  );
}
