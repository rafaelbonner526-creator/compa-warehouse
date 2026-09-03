"use client";

import { useEffect, useState } from "react";
import {
  Card, Empty, Grid, Meter, Page, Row, Stat, Table, Td, Tr, num, usd,
} from "@/components/ui";

type Data = { digest: Row[]; history: Row[]; plmOps: Row[]; plmPnl: Row[] };

/* Severity wears a RESERVED status colour and always ships with a label, so
   state is never carried by colour alone. */
const SEVERITY = {
  1: { label: "Act now", color: "var(--status-critical)" },
  2: { label: "At the review", color: "var(--status-warning)" },
  3: { label: "Context", color: "var(--text-muted)" },
} as const;


// PLM operational health. Catalog aggregates and RAG eval metrics only; no
// patient data is in this warehouse by construction.
//
// Search quality is shown as STABILITY, not as a trend line. recall@5 has been
// identical to sixteen decimals across 99 days because embeddings are
// deterministic and the golden set is fixed, so a chart of it would be a flat
// line pretending to be information. What matters is whether it moved.
function PlmOps({ rows }: { rows: Row[] }) {
  if (!rows?.length) return null;
  const db = rows.find((r) => r.area === "database");
  const rt = rows.find((r) => r.area === "retrieval");
  const unusedPct = db ? num(db.unused_index_pct) : 0;
  const stable = rt ? num(rt.runs_at_current_value) : 0;
  return (
    <Card title="PLM system" hint="Operational only. No patient data reaches this warehouse.">
      <Grid cols={4}>
        {db && (
          <>
            <Stat label="Database" value={`${num(db.db_size_mb).toFixed(0)} MB`} hint={`${db.user_tables} tables`} />
            <Stat
              label="Droppable indexes" value={`${db.droppable_indexes ?? 0}`}
              hint={`${num(db.droppable_index_kb).toFixed(0)} kB · ${db.unused_indexes} never scanned, most enforce constraints`}
              status={unusedPct >= 50 ? "warning" : undefined}
            />
            <Stat label="Dead rows" value={`${num(db.dead_tuple_pct).toFixed(0)}%`} hint="autovacuum acts near 20%" />
          </>
        )}
        {rt && (
          <Stat
            label="Search quality" value={stable >= 2 ? "unchanged" : "moved"}
            status={stable >= 2 ? "good" : "warning"}
            hint={`${stable} checks agree · ${num(rt.mean_latency_ms).toFixed(0)}ms typical`}
          />
        )}
      </Grid>
    </Card>
  );
}


// PLM money in and out, all time.
//
// LABOUR IS NOT IN HERE and the panel says so on its face. 305 commits over 8.5
// months is by far the largest input, and a "profit" that silently omits it
// would be the most misleading number on this dashboard.
function PlmPnl({ rows }: { rows: Row[] }) {
  if (!rows?.length) return null;
  const d = rows[0];
  const rev = num(d.revenue_all_time);
  const cost = num(d.cost_all_time);
  const net = num(d.net_all_time);
  const costPct = rev > 0 ? Math.min(100, (cost / rev) * 100) : 0;
  return (
    <Card
      title="PLM, money in and out"
      hint="All time. Your time is not counted: 305 commits over 8.5 months is the largest input by far, and a profit that omitted it would be the most misleading number here."
    >
      <Grid cols={3}>
        <Stat label="Earned" value={usd(rev)}
          hint={`${usd(num(d.revenue_build_manual))} build + ${usd(num(d.revenue_retainer_stripe))} retainer`} />
        <Stat label="Spent on tools" value={usd(cost)}
          hint={`${usd(num(d.cost_per_month))}/mo run rate against a $50 retainer`} />
        <Stat label="Net" value={`${net >= 0 ? "+" : "-"}${usd(Math.abs(net))}`}
          status={net >= 0 ? "good" : "critical"} hint="your time not counted" />
      </Grid>
      <div className="mt-4">
        <Meter value={cost} max={rev} color="var(--status-serious)"
          label={`Costs are ${costPct.toFixed(0)}% of revenue. The build fee is recorded by hand: it arrived as a bank transfer with no merchant name identifying it.`} />
      </div>
    </Card>
  );
}

export default function Review() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/review")
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setD(j)))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <Page title="Systems"><Card><Empty>Could not load: {err}</Empty></Card></Page>;
  if (!d) return <Page title="Systems"><Card><Empty>Loading…</Empty></Card></Page>;

  const groups = [1, 2, 3].map((sev) => ({
    sev: sev as 1 | 2 | 3,
    rows: d.digest.filter((r) => Number(r.severity) === sev),
  }));
  const actNow = groups[0].rows.length;
  const hist = d.history;

  return (
    <Page
      title="Systems"
      subtitle="PLM's operational health and the periodic review, assembled. A digest on the cadence the framework already prescribes, not an alert that interrupts when a number moves."
    >
      <div className="space-y-3">
        <PlmPnl rows={d.plmPnl} />
        <PlmOps rows={d.plmOps} />
      </div>

      <div
        className="mt-4 rounded-[var(--radius)] border px-4 py-3 text-sm"
        style={{
          borderColor: actNow > 0 ? "var(--status-critical)" : "var(--status-good)",
          background: "var(--surface-1)",
          color: actNow > 0 ? "var(--status-critical)" : "var(--status-good)",
        }}
      >
        {actNow > 0 ? (
          <>
            <strong className="font-semibold">
              {actNow} item{actNow === 1 ? "" : "s"} need action now.
            </strong>{" "}
            {d.digest.length} total in this review.
          </>
        ) : (
          <strong className="font-semibold">Nothing needs action. Everything is on cadence.</strong>
        )}
      </div>

      {groups.map(
        ({ sev, rows }) =>
          rows.length > 0 && (
            <section key={sev} className="mt-8">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: SEVERITY[sev].color }} />
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: SEVERITY[sev].color }}>
                  {SEVERITY[sev].label}
                </h2>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{rows.length}</span>
              </div>

              <div className="mt-3 space-y-2">
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--radius)] border px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                    style={{ borderColor: "var(--surface-3)", background: "var(--surface-1)" }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                          {String(r.section)}
                        </span>
                        {String(r.headline)}
                      </span>
                      {r.value && (
                        <span className="tnum text-xs" style={{ color: "var(--text-muted)" }}>{String(r.value)}</span>
                      )}
                    </div>
                    {r.detail && (
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{String(r.detail)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ),
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide tx-2">
          Snapshot history
        </h2>
        <p className="mt-1 text-xs leading-relaxed tx-m">
          One row per day. This is what lets a future review say what CHANGED rather than restating
          the dashboard. It starts thin and thickens with every run.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border bd-s3 bg-s1 p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide tx-m">
                <th className="pb-1.5 pr-3 font-medium">Date</th>
                <th className="pb-1.5 pr-3 text-right font-medium">US %</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Open actions</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Runway</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Revenue</th>
                <th className="pb-1.5 font-medium">Regime</th>
              </tr>
            </thead>
            <tbody className="tx-2">
              {hist.map((h) => (
                <tr key={String(h.snapshot_date)} className="border-t bd-s3">
                  <td className="py-1.5 pr-3 tabular-nums tx-2">
                    {String(h.snapshot_date).slice(0, 10)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{String(h.active_us_pct)}%</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{String(h.open_actions)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{String(h.runway_months)}mo</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    ${Math.round(Number(h.revenue_collected)).toLocaleString()}
                  </td>
                  <td className="py-1.5">{String(h.regime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hist.length < 2 && (
            <p className="mt-2 text-xs tx-m">
              Only {hist.length} snapshot so far, so there is no change to report yet. That is
              honest rather than a bug: a time series cannot show movement on its first day.
            </p>
          )}
        </div>
      </section>

      <p className="mt-8 text-xs leading-relaxed tx-m">
        The same content renders as plain text via{" "}
        <span className="font-mono">scripts/review_digest.py</span>, which prints to stdout so an
        existing cron can mail or message it without this page choosing a transport.
      </p>
    </Page>
  );
}
