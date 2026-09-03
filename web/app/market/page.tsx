"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
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
  declineSignals: Row[];
  newsClimate: Row[];
  valuation: Row | null;
  valuationRef: Row[];
  creditCycle: Row | null;
  cycleIntervals: Row[];
  powersDebt: Row[];
  worldShare: Row[];
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
  dollar_index: "US dollar index",
  real_rate_10y: "Real rate (10Y TIPS)",
  foreign_treasury: "Foreign-held Treasuries",
  policy_uncertainty: "US policy uncertainty",
  global_policy_uncertainty: "Global policy uncertainty",
  financial_stress: "Financial stress",
  vix: "Equity volatility (VIX)",
  recession_prob: "Recession probability",
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
  capacity_utilization: "How much industrial capacity is in use. Above its long-run average means overheating.",
  debt_to_gdp: "Federal debt as a share of the economy. The long-term debt cycle in one number.",
  house_prices: "National home price index. Drives the 18-year property cycle read.",
  dollar_index: "The dollar against a basket of trading partners. A sustained fall is a reserve-status warning.",
  real_rate_10y: "The 10-year yield after inflation. Negative means lenders lose purchasing power, the classic debasement tell.",
  foreign_treasury: "How much US government debt foreigners hold. Falling means the world is stepping back from funding the US.",
  policy_uncertainty: "Built by counting newspaper articles about policy uncertainty.",
  global_policy_uncertainty: "The same newspaper-count method, across major economies.",
  financial_stress: "18 market indicators in one number. Zero is normal, negative is calmer than usual.",
  vix: "What options markets charge for downside protection. Fear, priced in real money.",
  recession_prob: "Smoothed model probability the economy is in recession right now.",
};

// Plain-language meaning of each All Weather environment.
const BOX_DETAIL: Record<
  string,
  { plain: string; example: string; mine: string }
> = {
  rising_growth_falling_inflation: {
    plain:
      "The economy is expanding while prices stay calm. Companies grow earnings without their costs running away from them. This is the friendliest possible backdrop for owning businesses.",
    example: "Most of the 1990s, and 2013 through 2019.",
    mine: "Your equity book is this box. It is where almost all of your money already lives.",
  },
  rising_growth_rising_inflation: {
    plain:
      "The economy is still growing, but prices are climbing fast enough to eat into profits, and central banks start raising rates to cool it down. Real things beat paper claims on things.",
    example: "2021 into 2022, and the early 1970s.",
    mine: "Gold covers this. International and value tilt help, but they are still equities and still fall with the market.",
  },
  falling_growth_falling_inflation: {
    plain:
      "The economy is shrinking and prices are falling with it. Cash and government bonds win because they hold their value while everything else drops. This is the classic deflationary bust.",
    example: "2008 into 2009.",
    mine: "Left uncovered on purpose. See the note in the box.",
  },
  falling_growth_rising_inflation: {
    plain:
      "The worst combination. The economy stalls while prices keep rising, so central banks cannot cut rates to help without making inflation worse. There is nowhere comfortable to hide.",
    example: "1973 through 1975.",
    mine: "Gold is the only real shelter you hold here.",
  },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>{children}</div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs leading-relaxed text-zinc-500">{children}</p>;
}

function SectionHead({
  title,
  sub,
  anchor,
}: {
  title: string;
  sub: string;
  anchor: string;
}) {
  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link
          href={`/market/about#${anchor}`}
          className="text-xs text-indigo-400 underline-offset-2 hover:underline"
        >
          how this works →
        </Link>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500">{sub}</p>
    </div>
  );
}

// 1st / 2nd / 3rd / 4th..., including the 11-13 exceptions that a naive
// last-digit rule gets wrong.
function ordinal(n: number): string {
  const v = Math.round(n);
  const rem100 = v % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
}

function levelTone(level: string) {
  return level === "extreme"
    ? "text-red-400"
    : level === "elevated"
      ? "text-amber-400"
      : level === "calm"
        ? "text-emerald-400"
        : "text-zinc-300";
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
  const current = d.bigCycle.find((s) => s.is_current);

  // One row per power: its latest share and its own peak. mart_world_power is a
  // full time series, so collapse it here rather than shipping a second mart that
  // says the same thing. Sorted by current share, largest first.
  const latestShareYear = Math.max(0, ...d.worldShare.map((r) => Number(r.year)));
  const peakRows = d.worldShare
    .filter((r) => Number(r.year) === latestShareYear)
    .map((r) => ({
      country: r.country,
      now_pct: r.pct_of_world_gdp,
      peak_pct: r.peak_pct,
      peak_year: r.peak_year,
      pct_of_own_peak: r.pct_of_own_peak,
    }))
    .sort((a, b) => Number(b.now_pct) - Number(a.now_pct));
  const declineCount = d.declineSignals.filter((s) => s.points_to_decline === true).length;

  // Two boxes covered by the exact same holdings is the most useful thing this grid
  // can say: those environments share one hedge instead of having one each. Without
  // calling it out, it just reads as two identical percentages and looks like a bug.
  const val = d.valuation;
  const cc = d.creditCycle;
  const infl1 = d.allWeather.find((b) => b.box === "rising_growth_rising_inflation");
  const infl2 = d.allWeather.find((b) => b.box === "falling_growth_rising_inflation");
  const sharedHedge =
    infl1?.covering_tickers &&
    infl1.covering_tickers === infl2?.covering_tickers
      ? String(infl1.covering_tickers)
      : null;

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

  // ---- property cycle geometry ----
  const troughDate = pc ? String(pc.trough_date) : null;
  const troughYear = troughDate ? Number(troughDate.slice(0, 4)) : null;
  const hp = d.housePrices.map((x) => ({ d: String(x.obs_date), v: Number(x.value) }));
  const troughPoint = hp.find((p) => p.d === troughDate);
  const priorTroughDate = pc?.prior_trough_date ? String(pc.prior_trough_date) : null;
  const priorPoint = priorTroughDate ? hp.find((p) => p.d === priorTroughDate) : undefined;
  const nowPoint = hp.length ? hp[hp.length - 1] : null;
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Market</h1>
        {refreshed && <span className="text-xs text-zinc-500">Last refreshed {refreshed} ET</span>}
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Macro signals from FRED, read through Dalio&apos;s cycle frameworks.{" "}
        <Link href="/market/about" className="text-indigo-400 underline-offset-2 hover:underline">
          Full explanation of every section →
        </Link>
      </p>

      <div className="mt-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200/80">
        <strong className="font-semibold text-amber-200">Read-only.</strong> Signals, never verdicts,
        never trade instructions. Cycle reads inform the direction of the{" "}
        <em>pre-committed quarterly rebalance</em> and never justify a trade between rebalances.
        Research also finds that the more often you look at a portfolio, the less risk you take and the
        lower your returns. Checking this more than quarterly is the failure mode the page is designed
        against.
      </div>

      {/* ---------- regime ---------- */}
      <SectionHead
        title="Where the economy is right now"
        sub="Two numbers drive everything below: is the economy growing, and are prices rising."
        anchor="regime"
      />
      <Card className="mt-3">
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
            is different, and it is what drives the grid below: growth is{" "}
            <strong className="text-zinc-400">{String(r.growth_direction)}</strong> (
            {String(r.growth_yoy)}% now vs {String(r.growth_yoy_3m_ago)}% three months ago) and
            inflation is <strong className="text-zinc-400">{String(r.inflation_direction)}</strong> (
            {String(r.inflation_yoy)}% vs {String(r.inflation_yoy_3m_ago)}%). All Weather boxes are
            about change, not level, which is why the highlighted box below can differ from the label
            above.
          </Note>
        )}
      </Card>

      {/* ---------- all weather grid ---------- */}
      <SectionHead
        title="All Weather coverage"
        sub="Only four things can happen to an economy: growth and inflation can each go up or down. Dalio's rule is to own something that wins in each of the four, so no single surprise can wreck you. The highlighted box is where things are heading now."
        anchor="all-weather"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {d.allWeather.map((b) => {
          const key = String(b.box);
          const isNow = key === awBox;
          const byDesign = Boolean(b.by_design);
          const cov = String(b.coverage);
          const pct = Number(b.covering_pct);
          const detail = BOX_DETAIL[key];
          const tone = byDesign
            ? "text-zinc-500"
            : cov === "covered"
              ? "text-emerald-400"
              : cov === "thin"
                ? "text-amber-400"
                : "text-red-400";
          return (
            <div
              key={key}
              className={`rounded-2xl border p-5 ${
                isNow
                  ? "border-indigo-500/70 bg-indigo-950/30 ring-1 ring-indigo-500/30"
                  : "border-zinc-800 bg-zinc-900/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold text-zinc-200">{String(b.box_label)}</span>
                {isNow && (
                  <span className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                    heading here
                  </span>
                )}
              </div>

              {detail && (
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">{detail.plain}</p>
              )}
              {detail && (
                <p className="mt-1.5 text-[11px] text-zinc-600">
                  <span className="uppercase tracking-wide">Last seen:</span> {detail.example}
                </p>
              )}

              <div className="mt-3 border-t border-zinc-800 pt-3">
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-semibold ${tone}`}>{pct}%</span>
                  <span className={`text-xs uppercase tracking-wide ${tone}`}>
                    {byDesign ? "by choice" : cov}
                  </span>
                  <span className="ml-auto text-[11px] text-zinc-600">of portfolio</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  <span className="text-zinc-600">Wins here:</span> {String(b.wins)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  <span className="text-zinc-600">You hold:</span>{" "}
                  {b.covering_tickers ? (
                    <span className="font-mono text-[11px] text-zinc-400">
                      {String(b.covering_tickers)}
                    </span>
                  ) : (
                    <span className="text-zinc-600">nothing</span>
                  )}
                </p>
                {detail && <p className="mt-1 text-xs text-zinc-500">{detail.mine}</p>}
              </div>

              {byDesign && (
                <p className="mt-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                  {String(b.by_design_reason)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {sharedHedge && (
        <div className="mt-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200/80">
          <strong className="font-semibold text-amber-200">
            Both inflation boxes show the same number because the same asset covers both.
          </strong>{" "}
          <span className="font-mono">{sharedHedge}</span> is your entire inflation protection, in
          both the growing-and-inflating case and the stalling-and-inflating case. That is one hedge
          doing two jobs, not two hedges. It is also{" "}
          {Number(infl1?.covering_pct ?? 0)}% of the portfolio, so it can only move the outcome so
          much.
        </div>
      )}
      <Note>
        Percentages are the share of the total portfolio held in assets that historically win in that
        box, so they do not add to 100: gold counts in both inflationary boxes. International equity
        counts as equity, not as an inflation hedge, because it moves with the rest of the equity book.
        Counting it twice would show diversification you do not actually have.
      </Note>

      {/* ---------- evidence bands ---------- */}
      <SectionHead
        title="US vs International"
        sub="Your live split against two ceilings: the ALTO band (50-55% US) and the range the Cederburg research measures as costing almost nothing (11-55% US)."
        anchor="bands"
      />
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
          The ceiling moved from 65% to 55% on 2026-08-18. Past 55% US, the research shows the cost of
          the deviation starts to climb. Correct any overshoot by pointing new contributions at
          international, never by selling.
        </Note>
      </Card>

      {/* ---------- three equilibriums ---------- */}
      <SectionHead
        title="The three equilibriums"
        sub="Dalio's check that the economic machine is in balance. When all three sit in normal ranges the machine runs; when they stretch, something has to give."
        anchor="equilibriums"
      />
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Card>
          <span className="text-sm text-zinc-400">1. Debt vs income</span>
          <div className="mt-1 text-3xl font-semibold">
            {eq?.debt_to_gdp != null ? `${Number(eq.debt_to_gdp)}%` : "—"}
          </div>
          <div className="text-xs text-zinc-500">
            federal debt as a share of the economy
            {eq?.debt_to_gdp_chg_1y != null && (
              <>
                {" · "}
                {Number(eq.debt_to_gdp_chg_1y) >= 0 ? "+" : ""}
                {Number(eq.debt_to_gdp_chg_1y)}pp in a year
              </>
            )}
          </div>
          <Note>
            Debt has to grow slower than the income that services it, or the burden compounds. When it
            does not, the government eventually has to inflate the debt away, default, or be bailed out
            by its central bank. This is the engine of the Big Cycle below.
          </Note>
        </Card>
        <Card>
          <span className="text-sm text-zinc-400">2. Capacity</span>
          <div className="mt-1 text-3xl font-semibold">
            {eq?.capacity_utilization != null ? `${Number(eq.capacity_utilization)}%` : "—"}
          </div>
          <div className="text-xs text-zinc-500">
            {eq?.capacity_gap != null ? (
              <>
                {Number(eq.capacity_gap) >= 0 ? "+" : ""}
                {Number(eq.capacity_gap)}pp vs its long-run average
                {eq?.capacity_longrun_avg != null && <> of {Number(eq.capacity_longrun_avg)}%</>}
              </>
            ) : (
              "—"
            )}
          </div>
          <Note>
            How much of the country&apos;s factories and equipment are actually in use. Run above the
            long-run average and you get bottlenecks and inflation. Run below it and you have idle
            workers and machines, which is slack. Average computed over{" "}
            {eq?.capacity_n_obs ? String(eq.capacity_n_obs) : "?"} monthly readings, the full series since 1967.
          </Note>
        </Card>
        <Card>
          <span className="text-sm text-zinc-400">3. Risk-premium stack</span>
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
            Riskier money should pay more than safer money. Cash should pay least, government bonds
            more, corporate credit most. When that ladder inverts, money is being squeezed and
            something in the system is straining. The equity rung is{" "}
            <strong className="text-zinc-400">not measured</strong>: there is no free earnings-yield
            series, and inventing one would be worse than leaving it out.
          </Note>
        </Card>
      </div>

      {/* ---------- news climate ---------- */}
      <SectionHead
        title="What the world feels like"
        sub="World news, quantified. Two of these are built by literally counting newspaper articles; the other three are markets pricing their own fear. Each is shown as a percentile of its own full history, because a raw number tells you nothing about whether it is high."
        anchor="news"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {d.newsClimate.map((n) => {
          const pctile = Number(n.percentile);
          const level = String(n.level);
          return (
            <Card key={String(n.series)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-zinc-400">{String(n.label)}</span>
                <span className="text-lg font-semibold tabular-nums">{Number(n.latest_value)}</span>
              </div>
              <div className={`mt-1 text-xs font-medium uppercase tracking-wide ${levelTone(level)}`}>
                {level} · {ordinal(pctile)} percentile
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full ${
                    level === "extreme"
                      ? "bg-red-500"
                      : level === "elevated"
                        ? "bg-amber-500"
                        : level === "calm"
                          ? "bg-emerald-500"
                          : "bg-zinc-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, pctile))}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{String(n.explanation)}</p>
              {n.since_date && (
                <p className="mt-1 text-[11px] text-zinc-600">
                  percentile vs {String(n.since_date).slice(0, 4)}-present
                </p>
              )}
            </Card>
          );
        })}
      </div>
      <Note>
        The gap between these is the useful part. When the newspaper measures run hot while the market
        measures stay calm, the headlines are loud but money is not scared yet. Markets price what they
        expect to be paid, not what is upsetting. This section exists as slow context for the Big Cycle
        below, and is explicitly not a trading input.
      </Note>
      <Note>
        These windows are short and cannot be lengthened. The uncertainty indices begin in 1985, the
        VIX in 1990, the stress index in 1993, because none of them existed before that. Where a
        longer history does exist, as with valuation and debt below, this page uses all of it.
      </Note>

      {/* ---------- valuation (144y) ---------- */}
      <SectionHead
        title="Valuation, in 144 years of context"
        sub="Are people paying a sane price for company earnings? This is the crash pattern that shows up first: buying because it went up, not because of what it is worth."
        anchor="valuation"
      />
      {val && (
        <Card className="mt-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">CAPE ratio</div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold">{Number(val.cape)}</span>
                <span className={`text-sm font-medium uppercase tracking-wide ${levelTone(String(val.level))}`}>
                  {String(val.level)} · {ordinal(Number(val.percentile))} percentile
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                of {Number(val.n_obs).toLocaleString()} months since {String(val.since_year)}. Long-run
                median {Number(val.median_cape)}.
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              as of {String(val.as_of_year)}-{String(val.as_of_month).padStart(2, "0")}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {[
              { label: "Now", cape: Number(val.cape), now: true },
              ...d.valuationRef.map((x) => ({
                label: `${String(x.label)}`,
                cape: Number(x.cape),
                now: false,
              })),
            ]
              .sort((a, b) => b.cape - a.cape)
              .map((x) => (
                <div key={x.label} className="flex items-center gap-3">
                  <span className={`w-32 shrink-0 text-xs ${x.now ? "font-semibold text-indigo-300" : "text-zinc-500"}`}>
                    {x.label}
                  </span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-800/60">
                    <div
                      className={`h-full rounded ${x.now ? "bg-indigo-500" : "bg-zinc-600"}`}
                      style={{ width: `${(x.cape / Number(val.max_cape)) * 100}%` }}
                    />
                  </div>
                  <span className={`w-10 shrink-0 text-right text-xs tabular-nums ${x.now ? "font-semibold text-indigo-300" : "text-zinc-500"}`}>
                    {x.cape}
                  </span>
                </div>
              ))}
          </div>
          <Note>
            CAPE divides price by ten years of inflation-adjusted earnings, so a single good year
            cannot flatter it. This is the clearest argument for long history on the whole page:
            against the last 20 years today looks merely expensive, and against 144 years it sits
            above where the market stood before the 1929 crash. That is not a prediction. Expensive
            markets have stayed expensive for years, and CAPE has been a poor timing tool. It says
            what you are paying, not what happens next.
          </Note>
        </Card>
      )}

      {/* ---------- credit (151y) ---------- */}
      <SectionHead
        title="Debt buildup, in 151 years of context"
        sub="The fourth crash pattern, and the one that turns an ordinary bubble into a generational downturn. What matters more than the level is how fast it is growing."
        anchor="credit"
      />
      {cc && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Card>
            <span className="text-sm text-zinc-400">Private credit / GDP</span>
            <div className="mt-1 text-3xl font-semibold">{Number(cc.credit_to_gdp)}%</div>
            <div className={`text-xs font-medium uppercase tracking-wide ${levelTone(String(cc.level))}`}>
              {String(cc.level)} · {ordinal(Number(cc.credit_percentile))} percentile
            </div>
            <Note>
              Bank lending to households and firms, against its own history since{" "}
              {String(cc.since_year)}. This is the debt that drove 1929 and 2008.
            </Note>
          </Card>
          <Card>
            <span className="text-sm text-zinc-400">5-year change</span>
            <div className="mt-1 text-3xl font-semibold">
              {Number(cc.credit_change_5y) >= 0 ? "+" : ""}
              {Number(cc.credit_change_5y)}pp
            </div>
            <div
              className={`text-xs font-medium uppercase tracking-wide ${
                String(cc.credit_trend) === "boom"
                  ? "text-amber-400"
                  : String(cc.credit_trend) === "deleveraging"
                    ? "text-emerald-400"
                    : "text-zinc-400"
              }`}
            >
              {String(cc.credit_trend)}
            </div>
            <Note>
              Speed beats level as a warning sign. Roughly 10pp of growth in five years is the
              threshold above which credit expansions have historically preceded banking trouble.
            </Note>
          </Card>
          <Card>
            <span className="text-sm text-zinc-400">Public debt / GDP</span>
            <div className="mt-1 text-3xl font-semibold">{Number(cc.public_debt_to_gdp)}%</div>
            <div className="text-xs text-zinc-500">government borrowing</div>
            <Note>
              Kept separate from private credit on purpose. Sovereign debt crises and private credit
              busts behave differently, so the two are never summed.
            </Note>
          </Card>
        </div>
      )}
      {cc && (
        <Note>
          Source data ends {String(cc.until_year)}, so this is a structural read rather than a current
          one. The live debt-to-GDP figure in the Big Cycle section below comes from FRED and is
          current.
        </Note>
      )}

      {/* ---------- big cycle ---------- */}
      <SectionHead
        title="Dalio Big Cycle"
        sub="The 50-75 year arc of a dominant power: it wins, borrows against the win, and eventually has to print money to pay for it. Every reserve currency in history has run this arc."
        anchor="big-cycle"
      />
      <Card className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-zinc-400">
            Debt / GDP{" "}
            <strong className="text-zinc-200">
              {eq?.debt_to_gdp != null ? `${Number(eq.debt_to_gdp)}%` : "—"}
            </strong>
          </span>
          {current && (
            <span className="text-xs text-zinc-500">
              debasement risk:{" "}
              <strong
                className={
                  String(current.debasement_risk) === "high"
                    ? "text-red-400"
                    : String(current.debasement_risk) === "medium"
                      ? "text-amber-400"
                      : "text-emerald-400"
                }
              >
                {String(current.debasement_risk)}
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
                  cur ? "border-indigo-500/70 bg-indigo-950/30" : "border-zinc-800/70 bg-zinc-900/30"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className={`text-sm font-medium ${cur ? "text-indigo-200" : unreachable ? "text-zinc-600" : "text-zinc-400"}`}
                  >
                    {String(s.stage_order)}. {String(s.stage_name)}
                    {cur && (
                      <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                        you are here
                      </span>
                    )}
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
                {cur && <p className="mt-2 text-xs text-indigo-300/90">→ {String(s.implication)}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* decline criteria */}
      <Card className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-zinc-300">
            Are we actually in decline (stage 5)?
          </span>
          <span
            className={`text-sm font-semibold ${declineCount >= 3 ? "text-red-400" : declineCount >= 2 ? "text-amber-400" : "text-emerald-400"}`}
          >
            {declineCount} of {d.declineSignals.length} criteria met
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Debt-to-GDP alone cannot tell &quot;high debt, still the reserve currency, everyone still
          lends to you&quot; apart from &quot;high debt and the world is backing away.&quot; These are
          the four things Dalio says actually mark the turn.
        </p>

        <div className="mt-4 space-y-2">
          {d.declineSignals.map((s) => {
            const hit = s.points_to_decline === true;
            return (
              <div
                key={String(s.criterion_order)}
                className={`rounded-xl border px-4 py-3 ${
                  hit ? "border-amber-800/60 bg-amber-950/20" : "border-zinc-800/70 bg-zinc-900/30"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={`text-sm ${hit ? "text-amber-200" : "text-zinc-400"}`}>
                    {hit ? "⚠" : "✓"} {String(s.criterion)}
                  </span>
                  <span className="text-xs tabular-nums text-zinc-500">
                    {Number(s.latest_value).toLocaleString()}{" "}
                    <span className="text-zinc-600">{String(s.unit)}</span>
                    {s.chg_1y_pct != null && (
                      <>
                        {" · "}
                        {Number(s.chg_1y_pct) >= 0 ? "+" : ""}
                        {Number(s.chg_1y_pct)}% 1y
                      </>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">{String(s.explanation)}</p>
              </div>
            );
          })}
        </div>
        <Note>
          Wars, elections and frightening headlines are not on this list, and that is deliberate. They
          are stage 4 features, not stage 5 evidence: &quot;internal conflict rising, rival
          emerging&quot; is the literal description of the stage. The turn shows up in whether the
          world still lends to you and at what real rate, which is what these four measure.
        </Note>
      </Card>

      {/* ---------- the same arc, other powers ---------- */}
      <SectionHead
        title="The same arc, other powers"
        sub="The section above scores the United States alone. Dalio's claim is comparative: powers rise, borrow against the win, and hand off. These two panels put the others on the same measures."
        anchor="other-powers"
      />
      <Card className="mt-3">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Public debt, same stage bands
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          From the IMF historical public debt database, which reaches 1800 for the UK and 1885 for
          Russia. Each country is shown as of its own latest year. These figures are NOT comparable
          to the live US number above, which comes from FRED.
        </p>
        <div className="mt-4 space-y-2">
          {d.powersDebt.map((r) => {
            const us = String(r.country) === "United States";
            const pctOwn = Number(r.pct_of_own_history);
            return (
              <div
                key={String(r.country)}
                className={`rounded-xl border px-4 py-3 ${
                  us ? "border-indigo-500/70 bg-indigo-950/30" : "border-zinc-800/70 bg-zinc-900/30"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={`text-sm font-medium ${us ? "text-indigo-200" : "text-zinc-300"}`}>
                    {String(r.country)}
                    <span className="ml-2 text-[11px] font-normal text-zinc-500">
                      {String(r.stage_name)}
                    </span>
                  </span>
                  <span className="text-[11px] tabular-nums text-zinc-400">
                    {Number(r.debt_to_gdp)}% of GDP
                    <span className="text-zinc-600">
                      {" · "}
                      {Number(r.debt_to_gdp_chg_5y) >= 0 ? "+" : ""}
                      {Number(r.debt_to_gdp_chg_5y)} in 5y · {String(r.trajectory)}
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  Higher than {pctOwn}% of its own history, measured over{" "}
                  {Number(r.years_on_record)} years since {Number(r.history_from)}. As of{" "}
                  {Number(r.as_of_year)}.
                </p>
              </div>
            );
          })}
        </div>
        <Note>
          Read the record length before the percentile. China has 35 years on file and the United
          Kingdom has 225, so &quot;highest in its own history&quot; means something very different
          for each. The UK sat at 176% in 1800 after the Napoleonic wars and has been here before.
        </Note>
      </Card>

      <Card className="mt-3">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Share of world output</div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Maddison Project, at its benchmark years. Debt says how indebted a country is; this says
          who is ascending and who is being overtaken.
        </p>
        <div className="mt-4 space-y-2">
          {peakRows.map((r) => {
            const share = Number(r.now_pct);
            const ofPeak = Number(r.pct_of_own_peak);
            return (
              <div key={String(r.country)} className="rounded-xl border border-zinc-800/70 bg-zinc-900/30 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-zinc-300">{String(r.country)}</span>
                  <span className="text-[11px] tabular-nums text-zinc-400">
                    {share.toFixed(1)}% now
                    <span className="text-zinc-600">
                      {" · peaked "}
                      {Number(r.peak_pct).toFixed(1)}% in {Number(r.peak_year)}
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-indigo-500/70"
                    style={{ width: `${Math.max(2, Math.min(100, ofPeak))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">{ofPeak}% of its own peak</p>
              </div>
            );
          })}
        </div>
        <Note>
          The handoff is the point. Britain and America cross in 1870 at about 9% each. America peaks
          at 27% in 1950. China falls from 29% in 1820 to 5% in 1950 and is back above America on
          this measure since roughly 2015. That is the arc the stages above are describing.
        </Note>
      </Card>

      {/* ---------- 18-year property cycle ---------- */}
      <SectionHead
        title="18-year property cycle"
        sub="A repeating rhythm of roughly 18 years: long recovery, mid-cycle wobble, bigger boom, mania, crash. Below, the model is tested against 151 years of real house prices across 18 countries rather than assumed."
        anchor="property-cycle"
      />
      <Card className="mt-3">
        {pc && troughYear ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Current phase</div>
                <div className="text-3xl font-semibold">
                  {String(pc.phase).startsWith("Past model horizon")
                    ? "Beyond the model's 18 years"
                    : String(pc.phase)}
                </div>
                {String(pc.phase).startsWith("Past model horizon") && (
                  <div className="mt-1 max-w-md text-xs leading-relaxed text-amber-300/80">
                    More than 18 years have passed since the last cycle low without a new one, so
                    the model has run out of road. That is a statement about the model, not a
                    prediction about prices.
                  </div>
                )}
              </div>
              <div className="text-right text-xs text-zinc-500">
                <div>
                  cycle started{" "}
                  <strong className="text-zinc-300">{troughDate?.slice(0, 7)}</strong> (measured low)
                </div>
                <div>
                  year <strong className="text-zinc-300">{yearsIn}</strong> of 18 · prices +
                  {Number(pc.pct_off_trough)}% since
                </div>
              </div>
            </div>

            {/* timeline with real years */}
            <div className="mt-12">
              <div className="relative">
                {/* now marker above the bar */}
                <div
                  className="absolute -top-6 z-10 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-indigo-300"
                  style={{ left: `${Math.min(99, Math.max(1, pctComplete))}%` }}
                >
                  today
                </div>
                <div
                  className="absolute -top-1 bottom-0 z-10 w-0.5 -translate-x-1/2 bg-indigo-400"
                  style={{ left: `${Math.min(99, Math.max(1, pctComplete))}%` }}
                />
                <div className="flex h-12 w-full overflow-hidden rounded-lg border border-zinc-700">
                  {PHASES.map((p) => {
                    const active = yearsIn >= p.from && yearsIn < p.to;
                    return (
                      <div
                        key={p.label}
                        style={{ width: `${((p.to - p.from) / 18) * 100}%` }}
                        className={`flex flex-col items-center justify-center border-r border-zinc-700 px-1 text-center leading-tight last:border-r-0 ${
                          active
                            ? "bg-indigo-600/50 text-indigo-50"
                            : "bg-zinc-900/70 text-zinc-500"
                        }`}
                      >
                        <span className="text-[10px] font-medium">{p.label}</span>
                        <span className="text-[9px] opacity-70">
                          {troughYear + p.from}–{troughYear + p.to}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
                <span>{troughYear} low</span>
                <span>{troughYear + 18} next low, if the model&apos;s 18 years holds</span>
              </div>
            </div>

            {/* does the 18-year cycle actually exist? */}
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">
                  Does the 18-year cycle actually exist?
                </span>
                <span className="text-xs text-zinc-500">
                  {Number(pc.n_intervals)} intervals · {Number(pc.n_countries)} countries · 1870-2020
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-2xl font-semibold text-emerald-400">
                    {Number(pc.measured_median)}y
                  </div>
                  <div className="text-xs text-zinc-500">
                    measured median (mean {Number(pc.measured_mean)}y)
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-amber-400">
                    ±{Number(pc.measured_sd)}y
                  </div>
                  <div className="text-xs text-zinc-500">
                    standard deviation, range {Number(pc.measured_min)}-{Number(pc.measured_max)}y
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-amber-400">
                    {Number(pc.pct_within_16_20)}%
                  </div>
                  <div className="text-xs text-zinc-500">of cycles actually landed in 16-20 years</div>
                </div>
              </div>

              {d.cycleIntervals.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs text-zinc-500">
                    All {Number(pc.n_intervals)} measured cycles, grouped by how long they lasted.
                    Gold is the 16-20 year window the model claims.
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart
                      data={d.cycleIntervals.map((x) => ({
                        bucket: String(x.bucket),
                        n: Number(x.n),
                      }))}
                      margin={{ left: 4, right: 8, top: 6, bottom: 22 }}
                    >
                      <XAxis
                        dataKey="bucket"
                        tick={{ fill: "#a1a1aa", fontSize: 11 }}
                        label={{
                          value: "cycle length (years)",
                          position: "insideBottom",
                          offset: -14,
                          fill: "#71717a",
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        width={30}
                        allowDecimals={false}
                        label={{
                          value: "cycles",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#71717a",
                          fontSize: 11,
                        }}
                      />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }}
                        labelFormatter={(v) => `${v} year cycles`}
                        formatter={(v) => [`${v} of ${Number(pc.n_intervals)}`, "count"]}
                        cursor={{ fill: "#27272a55" }}
                      />
                      <Bar dataKey="n" radius={[4, 4, 0, 0]}>
                        {d.cycleIntervals.map((x, i) => (
                          <Cell key={i} fill={String(x.bucket) === "16-20" ? AMBER : "#52525b"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-1 text-xs text-zinc-500">
                    The gold bar is the tallest, so the model is picking a real central
                    tendency. It is also only {Number(pc.pct_within_16_20)}% of all cycles, and the
                    two bars either side of it together hold far more. That is the whole finding.
                  </div>
                </div>
              )}

              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                <strong className="text-zinc-200">The verdict is split.</strong> The model&apos;s
                headline number is genuinely right on average: a measured median of{" "}
                {Number(pc.measured_median)} years and mean of {Number(pc.measured_mean)} against a
                claimed 18 is a close match, and not something you would get from noise. But the
                spread is enormous. Only {Number(pc.pct_within_16_20)}% of real cycles landed in the
                16-20 year window, and they ranged from {Number(pc.measured_min)} to{" "}
                {Number(pc.measured_max)} years. It describes the average well and predicts any
                individual cycle badly.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                <strong className="text-zinc-200">The US is the worst case.</strong> Its{" "}
                {Number(pc.usa_n_intervals)} measured intervals averaged {Number(pc.usa_mean)} years
                and ran from {Number(pc.usa_min)} to {Number(pc.usa_max)}. Its own most recent
                completed cycle, {String(pc.prior_trough_date).slice(0, 4)} to{" "}
                {String(pc.trough_date).slice(0, 4)}, ran{" "}
                <strong className="text-zinc-300">{Number(pc.last_us_interval_years)} years</strong>,
                not 18. Applied to the current cycle, the measured quartiles put the next low
                anywhere between{" "}
                <strong className="text-zinc-300">{Number(pc.next_low_earliest)}</strong> and{" "}
                <strong className="text-zinc-300">{Number(pc.next_low_latest)}</strong>, and the
                earlier of those is already behind us.
              </p>
            </div>

            {/* price chart: pre-cycle greyed, current cycle highlighted */}
            <div className="mt-6">
              <div className="mb-1 text-sm font-medium text-zinc-300">
                US home prices since {String(pc.first_date).slice(0, 4)}
              </div>
              <div className="mb-2 text-xs leading-relaxed text-zinc-500">
                Case-Shiller national index. Green dots are the two cycle lows the model located,{" "}
                <strong className="text-zinc-400">{priorTroughDate?.slice(0, 7)}</strong> and{" "}
                <strong className="text-zinc-400">{troughDate?.slice(0, 7)}</strong>. The shaded
                section is the completed cycle between them, which ran{" "}
                {Number(pc.last_us_interval_years)} years. Everything to the right of the second dot
                is the cycle we are currently in.
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={hp} margin={{ left: -12, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="hpFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AMBER} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {priorTroughDate && troughDate && (
                    <ReferenceArea
                      x1={priorTroughDate}
                      x2={troughDate}
                      fill="#52525b"
                      fillOpacity={0.18}
                      label={{
                        value: `previous cycle · ${Number(pc.last_us_interval_years)}y`,
                        fill: "#a1a1aa",
                        fontSize: 10,
                        position: "insideTop",
                      }}
                    />
                  )}
                  <XAxis
                    dataKey="d"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    minTickGap={55}
                    tickFormatter={(v) => String(v).slice(0, 4)}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    width={46}
                    domain={["auto", "auto"]}
                    label={{
                      value: "index",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#71717a",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }}
                    labelFormatter={(v) => String(v).slice(0, 7)}
                    formatter={(v) => [Number(v).toFixed(1), "index"]}
                  />
                  <Area type="monotone" dataKey="v" stroke={AMBER} strokeWidth={2} fill="url(#hpFill)" />
                  {troughDate && (
                    <ReferenceLine
                      x={troughDate}
                      stroke={GREEN}
                      strokeDasharray="3 3"
                      label={{ value: "cycle low", fill: GREEN, fontSize: 10, position: "insideTopRight" }}
                    />
                  )}
                  {troughPoint && (
                    <ReferenceDot x={troughPoint.d} y={troughPoint.v} r={5} fill={GREEN} stroke="none" />
                  )}
                  {priorPoint && (
                    <ReferenceDot x={priorPoint.d} y={priorPoint.v} r={5} fill={GREEN} stroke="none" />
                  )}
                  {nowPoint && (
                    <ReferenceDot
                      x={nowPoint.d}
                      y={nowPoint.v}
                      r={5}
                      fill={ACCENT}
                      stroke="#e0e7ff"
                      strokeWidth={1.5}
                      label={{ value: "today", fill: "#c7d2fe", fontSize: 10, position: "left" }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200/80">
              <strong className="font-semibold text-amber-200">Contested model. Read it as an overlay.</strong>{" "}
              The cycle low and the elapsed years are <em>measured</em> from Case-Shiller data. The
              18-year length and the phase boundaries are <em>modeled</em>, from a framework with only
              a handful of observed cycles behind it. It is not a forecast. It is also not a Warren
              Buffett model, which it is frequently miscredited as: it comes from Fred Harrison and
              Phil Anderson, building on Homer Hoyt&apos;s land-value work.
              {Boolean(pc.trough_at_edge) && (
                <>
                  {" "}
                  <strong className="text-red-300">
                    Warning: the located low sits at the edge of the available data, so it may be a
                    window boundary rather than a real low.
                  </strong>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">No home price data loaded.</p>
        )}
      </Card>

      {/* ---------- indicators ---------- */}
      <SectionHead
        title="Raw indicators"
        sub="The underlying series everything above is built from."
        anchor="indicators"
      />
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
              <p className="mt-1 text-xs leading-snug text-zinc-500">{BLURBS[s] ?? ""}</p>
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
