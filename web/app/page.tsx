"use client";

/* Money. Rebuilt 2026-09-03 as the reference implementation for the new design
   system: validated colour tokens, shared primitives, a real font, and an
   interaction layer on every chart.
   ------------------------------------------------------------------------
   FORM FOLLOWS THE DATA'S JOB, per the dataviz procedure:
     one headline value, no comparison   -> stat tile, not a chart
     change over time                    -> area/line with crosshair + tooltip
     magnitude across a few categories   -> horizontal bars with direct labels
     a value against a bound             -> meter
   Colour is assigned last and only from tokens; no hex literals live here.  */

import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Card, Empty, Grid, Meter, Page, Row, Segmented, Stat, Table, Td, Tip, Tr,
  compact, num, pct, seriesColor, usd,
} from "@/components/ui";

type Data = {
  sts: Row; networth: Row[]; breakdown: Row[]; cashflow: Row[];
  categories: Row[]; merchants: Row[]; bills: Row[]; runway: Row | null;
  budget: Row[]; componentSpend: Row[]; refreshed_at: string | null;
};

type Range = "30" | "90" | "all";

export default function Money() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("90");

  useEffect(() => {
    fetch("/api/budget")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => (j.error ? Promise.reject(new Error(j.error)) : setD(j)))
      .catch((e) => setErr(String(e.message ?? e)));
  }, []);

  const nw = useMemo(() => {
    if (!d) return [];
    const all = d.networth.map((r) => ({
      date: String(r.snapshot_date),
      label: String(r.snapshot_date).slice(5),
      v: num(r.net_worth),
    }));
    if (range === "all") return all;
    return all.slice(-Number(range));
  }, [d, range]);

  if (err) return <Page title="Money"><Card><Empty>Could not load: {err}</Empty></Card></Page>;
  if (!d) return <Page title="Money"><Card><Empty>Loading…</Empty></Card></Page>;

  const s = d.sts;
  const left = num(s.flexible_left);
  const budget = num(s.flexible_target);
  const spent = num(s.flexible_spent_this_month);
  const actualRate = num(s.actual_savings_rate_pct);
  const targetRate = num(s.target_savings_rate_pct);

  const nwNow = nw.length ? nw[nw.length - 1].v : 0;
  const nwThen = nw.length ? nw[0].v : 0;
  const nwDelta = nwNow - nwThen;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const perDay = Math.max(left, 0) / Math.max(daysLeft, 1);

  const cf = [...d.cashflow].reverse().map((r) => ({
    month: String(r.month).slice(0, 7),
    income: num(r.income), spend: num(r.spend), net: num(r.net),
  }));

  const cats = d.categories
    .map((r) => ({ name: String(r.category_group), spend: num(r.spend) }))
    .sort((a, b) => b.spend - a.spend);
  const catMax = cats.length ? cats[0].spend : 0;

  const spendRows = d.componentSpend ?? [];
  const spend90 = spendRows.reduce((a, r) => a + num(r.spend_90d), 0);

  const refreshed = d.refreshed_at
    ? new Date(d.refreshed_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : null;

  return (
    <Page
      title="Money"
      subtitle="Spending, net worth and what the tooling costs. Figures come from your bank records, not from anyone's dashboard."
      actions={refreshed ? <span className="text-xs" style={{ color: "var(--text-muted)" }}>Updated {refreshed}</span> : null}
    >
      {/* Headlines first: four values, no comparison, so tiles not charts. */}
      <Grid cols={4}>
        <Stat
          label="Left to spend this month" value={usd(left)}
          status={left <= 0 ? "critical" : left < budget * 0.2 ? "warning" : "good"}
          hint={`${usd(perDay)}/day for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}`}
        />
        <Stat
          label="Net worth" value={usd(nwNow)}
          delta={nwDelta} deltaLabel={`${usd(Math.abs(nwDelta))} over ${range === "all" ? "all time" : `${range} days`}`}
        />
        <Stat
          label="Savings rate" value={pct(actualRate)}
          status={actualRate >= targetRate ? "good" : "warning"}
          hint={`target ${pct(targetRate)}`}
        />
        <Stat
          label="Tooling, last 90 days" value={usd(spend90)}
          hint={`${spendRows.filter((r) => num(r.spend_90d) > 0).length} services with a charge`}
        />
      </Grid>

      {/* Filters in ONE row above the charts they control. */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Over time</h2>
        <Segmented<Range>
          ariaLabel="Time range" value={range} onChange={setRange}
          options={[{ value: "30", label: "30d" }, { value: "90", label: "90d" }, { value: "all", label: "All" }]}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card title="Net worth" hint="One series, so the title names it and no legend is needed." className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={nw} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis tickFormatter={(v) => compact(Number(v))} tickLine={false} axisLine={false} width={44} />
                {/* Crosshair + tooltip: an HTML chart is interactive by default. */}
                <Tooltip
                  cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }}
                  content={<Tip format={(v) => usd(v)} />}
                />
                <Area
                  type="monotone" dataKey="v" name="Net worth"
                  stroke="var(--series-1)" strokeWidth={2} fill="url(#nwFill)"
                  dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Income against spending" hint="Two series, so both are in the legend and the tooltip.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cf} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tickFormatter={(v) => compact(Number(v))} tickLine={false} axisLine={false} width={44} />
                <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip format={(v) => usd(v)} />} />
                <Bar dataKey="income" name="In" fill={seriesColor(2)} radius={[4, 4, 0, 0]} />
                <Bar dataKey="spend" name="Out" fill={seriesColor(1)} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: seriesColor(2) }} />In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: seriesColor(1) }} />Out
            </span>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Where it goes" hint="Magnitude across categories, ranked, with values labelled directly.">
          {cats.length === 0 ? <Empty>No category data.</Empty> : (
            <div className="space-y-2.5">
              {cats.slice(0, 8).map((c, i) => (
                <div key={c.name}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                    <span className="tnum" style={{ color: "var(--text-primary)" }}>{usd(c.spend)}</span>
                  </div>
                  <Meter value={c.spend} max={catMax} color={seriesColor(i)} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="What the tooling costs"
          hint="Charged is what left the account. Caused by PLM is measured separately and exists only for Claude, whose bill also covers your own use."
          right={<span className="tnum text-lg font-semibold">{usd(spend90)}<span className="ml-1 text-xs font-normal" style={{ color: "var(--text-muted)" }}>90d</span></span>}
        >
          {spendRows.length === 0 ? <Empty>No spend data.</Empty> : (
            <Table head={["Component", "Serves", "Per month", "All time", "By PLM"]}>
              {spendRows.map((r, i) => {
                const att = r.plm_attributed_90d == null ? null : num(r.plm_attributed_90d);
                const none = Boolean(r.no_charges_matched);
                return (
                  <Tr key={i}>
                    <Td align="left" mono={false} color="var(--text-primary)">
                      {String(r.component)}
                      {none && <span className="ml-2 text-[10px]" style={{ color: "var(--status-warning)" }}>no charge</span>}
                    </Td>
                    <Td align="left" mono={false}>{String(r.serves)}</Td>
                    <Td>{usd(num(r.spend_per_month), true)}</Td>
                    <Td color="var(--text-muted)">{usd(num(r.spend_usd))}</Td>
                    <Td color={att != null ? "var(--status-good)" : undefined}>
                      {att != null ? usd(att, true) : "—"}
                    </Td>
                  </Tr>
                );
              })}
            </Table>
          )}
        </Card>
      </div>
    </Page>
  );
}
