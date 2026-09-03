"use client";

import { useEffect, useState } from "react";

type Row = Record<string, string | number | null>;
type Data = { digest: Row[]; history: Row[]; plmOps: Row[] };

const SEVERITY = {
  1: { label: "Act now", tone: "text-red-400", dot: "bg-red-400" },
  2: { label: "At the review", tone: "text-amber-400", dot: "bg-amber-400" },
  3: { label: "Context", tone: "text-zinc-400", dot: "bg-zinc-500" },
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
  const n = (v: unknown) => (v == null ? null : Number(v));
  const unusedPct = n(db?.unused_index_pct);
  const stable = n(rt?.runs_at_current_value);
  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-sm font-semibold text-zinc-300">PLM system</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Operational only. No patient data reaches this warehouse.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {db && (
          <>
            <div>
              <div className="text-xs text-zinc-500">Database</div>
              <div className="text-lg font-semibold">{n(db.db_size_mb)?.toFixed(0)} MB</div>
              <div className="text-[11px] text-zinc-500">{String(db.user_tables)} tables</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Unused indexes</div>
              <div className="text-lg font-semibold"
                   style={{ color: unusedPct != null && unusedPct >= 50 ? "#fbbf24" : undefined }}>
                {String(db.unused_indexes)}/{String(db.total_indexes)}
              </div>
              <div className="text-[11px] text-zinc-500">
                {unusedPct?.toFixed(0)}% never scanned
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Dead rows</div>
              <div className="text-lg font-semibold">{n(db.dead_tuple_pct)?.toFixed(0)}%</div>
              <div className="text-[11px] text-zinc-500">autovacuum acts near 20%</div>
            </div>
          </>
        )}
        {rt && (
          <div>
            <div className="text-xs text-zinc-500">Search quality</div>
            <div className="text-lg font-semibold">
              {stable && stable >= 2 ? "unchanged" : "moved"}
            </div>
            <div className="text-[11px] text-zinc-500">
              {stable ? `${stable} checks agree` : "check it"} &middot;{" "}
              {n(rt.mean_latency_ms)?.toFixed(0)}ms
            </div>
          </div>
        )}
      </div>
    </div>
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

  if (err) return <main className="p-8 text-red-400">Error: {err}</main>;
  if (!d) return <main className="p-8 text-zinc-500">Loading…</main>;

  const groups = [1, 2, 3].map((sev) => ({
    sev: sev as 1 | 2 | 3,
    rows: d.digest.filter((r) => Number(r.severity) === sev),
  }));
  const actNow = groups[0].rows.length;
  const hist = d.history;

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-4">
      <PlmOps rows={d.plmOps} />
      <h1 className="text-2xl font-semibold">Review</h1>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500">
        The periodic review, assembled. This page exists because the governance stack says look
        quarterly, which leaves nothing to tell you when quarterly has arrived. It is a digest, not
        an alert: it reports on the cadence the framework already prescribes rather than interrupting
        you when a number moves.
      </p>

      <div
        className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          actNow > 0
            ? "border-red-900/60 bg-red-950/20 text-red-200"
            : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200"
        }`}
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
                <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY[sev].dot}`} />
                <h2 className={`text-sm font-semibold uppercase tracking-wide ${SEVERITY[sev].tone}`}>
                  {SEVERITY[sev].label}
                </h2>
                <span className="text-xs text-zinc-600">{rows.length}</span>
              </div>

              <div className="mt-3 space-y-2">
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-200">
                        <span className="mr-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                          {String(r.section)}
                        </span>
                        {String(r.headline)}
                      </span>
                      {r.value && (
                        <span className="text-xs tabular-nums text-zinc-500">{String(r.value)}</span>
                      )}
                    </div>
                    {r.detail && (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{String(r.detail)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ),
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Snapshot history
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          One row per day. This is what lets a future review say what CHANGED rather than restating
          the dashboard. It starts thin and thickens with every run.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide text-zinc-600">
                <th className="pb-1.5 pr-3 font-medium">Date</th>
                <th className="pb-1.5 pr-3 text-right font-medium">US %</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Open actions</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Runway</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Revenue</th>
                <th className="pb-1.5 font-medium">Regime</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              {hist.map((h) => (
                <tr key={String(h.snapshot_date)} className="border-t border-zinc-800/70">
                  <td className="py-1.5 pr-3 tabular-nums text-zinc-300">
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
            <p className="mt-2 text-xs text-zinc-600">
              Only {hist.length} snapshot so far, so there is no change to report yet. That is
              honest rather than a bug: a time series cannot show movement on its first day.
            </p>
          )}
        </div>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-zinc-600">
        The same content renders as plain text via{" "}
        <span className="font-mono">scripts/review_digest.py</span>, which prints to stdout so an
        existing cron can mail or message it without this page choosing a transport.
      </p>
    </main>
  );
}
