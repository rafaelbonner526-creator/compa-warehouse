"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Row = Record<string, string | number | null>;

/**
 * Site-wide data freshness strip.
 *
 * Exists because the dashboard renders a CAPE reading from 2024, a credit ratio
 * from 2020 and a Fed funds rate from today next to each other, and nothing on
 * the page said so. It reports two different things on purpose:
 *   data through  -- how old the newest observation is
 *   last pulled   -- whether the pipeline is still running
 * A source can be loaded this morning and still end in 2020. Collapsing those
 * into one "updated" timestamp is how a stale number gets read as current.
 */
export default function Freshness() {
  const path = usePathname();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/freshness")
      .then((r) => r.json())
      .then((j) => (j.sources ? setRows(j.sources) : null))
      .catch(() => null);
  }, []);

  if (path === "/login" || !rows || rows.length === 0) return null;

  const stale = rows.filter((r) => String(r.status) === "stale");
  const lagging = rows.filter((r) => String(r.status) === "lagging");
  const worst = stale.length ? "stale" : lagging.length ? "lagging" : "current";

  // Restored 2026-09-03. A catch-all regex in the token migration replaced every
  // palette class with an empty string and blanked all three branches, so the
  // status dot rendered invisible while the build stayed green. Status colours
  // are reserved tokens and the dot is always accompanied by the summary text,
  // so state is never carried by colour alone.
  const dot =
    worst === "stale" ? "bg-crit" : worst === "lagging" ? "bg-warn" : "bg-good";
  const summary =
    worst === "current"
      ? `All ${rows.length} sources current`
      : `${stale.length + lagging.length} of ${rows.length} sources behind`;

  const age = (d: number) =>
    d < 45 ? `${d}d` : d < 400 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}y`;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border bd-s3 bg-s1 px-3 py-1.5 text-left text-xs tx-2 hover:bd-s3"
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
        <span>{summary}</span>
        <span className="ml-auto tx-m">{open ? "hide" : "data freshness"}</span>
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto rounded-lg border bd-s3 bg-s1 p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide tx-m">
                <th className="pb-1.5 pr-3 font-medium">Source</th>
                <th className="pb-1.5 pr-3 font-medium">Data through</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Age</th>
                <th className="pb-1.5 pr-3 font-medium">Last pulled</th>
                <th className="pb-1.5 font-medium">Feeds</th>
              </tr>
            </thead>
            <tbody className="tx-2">
              {rows.map((r) => {
                const st = String(r.status);
                const tone =
                  st === "stale"
                    ? "tx-crit"
                    : st === "lagging"
                      ? "tx-warn"
                      : "tx-good";
                return (
                  <tr key={String(r.source)} className="border-t bd-s3">
                    <td className="py-1.5 pr-3 tx-2">{String(r.source)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {String(r.data_through ?? "—").slice(0, 10)}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${tone}`}>
                      {r.data_age_days == null ? "—" : age(Number(r.data_age_days))}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums tx-m">
                      {r.last_loaded ? String(r.last_loaded).slice(0, 10) : "—"}
                    </td>
                    <td className="py-1.5 tx-m">{String(r.feeds ?? "")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 leading-relaxed tx-m">
            Age is how old the newest observation is, not when we last pulled. A research dataset
            can be pulled this morning and still end in 2020, which is what &quot;stale&quot; means
            here: the source itself has not published, not that the pipeline is broken.
          </p>
        </div>
      )}
    </div>
  );
}
