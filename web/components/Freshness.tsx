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

  const dot =
    worst === "stale" ? "bg-red-400" : worst === "lagging" ? "bg-amber-400" : "bg-emerald-400";
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
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-1.5 text-left text-xs text-zinc-400 hover:border-zinc-700"
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
        <span>{summary}</span>
        <span className="ml-auto text-zinc-600">{open ? "hide" : "data freshness"}</span>
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide text-zinc-600">
                <th className="pb-1.5 pr-3 font-medium">Source</th>
                <th className="pb-1.5 pr-3 font-medium">Data through</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Age</th>
                <th className="pb-1.5 pr-3 font-medium">Last pulled</th>
                <th className="pb-1.5 font-medium">Feeds</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              {rows.map((r) => {
                const st = String(r.status);
                const tone =
                  st === "stale"
                    ? "text-red-400"
                    : st === "lagging"
                      ? "text-amber-400"
                      : "text-emerald-400";
                return (
                  <tr key={String(r.source)} className="border-t border-zinc-800/70">
                    <td className="py-1.5 pr-3 text-zinc-300">{String(r.source)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {String(r.data_through ?? "—").slice(0, 10)}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${tone}`}>
                      {r.data_age_days == null ? "—" : age(Number(r.data_age_days))}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums text-zinc-500">
                      {r.last_loaded ? String(r.last_loaded).slice(0, 10) : "—"}
                    </td>
                    <td className="py-1.5 text-zinc-500">{String(r.feeds ?? "")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 leading-relaxed text-zinc-600">
            Age is how old the newest observation is, not when we last pulled. A research dataset
            can be pulled this morning and still end in 2020, which is what &quot;stale&quot; means
            here: the source itself has not published, not that the pipeline is broken.
          </p>
        </div>
      )}
    </div>
  );
}
