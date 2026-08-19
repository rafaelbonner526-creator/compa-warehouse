"use client";

import { useEffect, useState } from "react";

const GREEN = "#34d399";
const RED = "#f87171";
const ACCENT = "#818cf8";

type Row = Record<string, string | number | boolean | null>;
type Data = {
  signals: Row;
  allocation: Row[];
  positions: Row[];
  refreshed_at: string | null;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>
      {children}
    </div>
  );
}

function Signal({ label, value, target, ok }: { label: string; value: string; target: string; ok: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: ok ? GREEN : RED }} />
      </div>
      <div className="mt-1 text-3xl font-semibold" style={{ color: ok ? "#fafafa" : RED }}>
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        target {target} · {ok ? "on target" : "off target"}
      </div>
    </Card>
  );
}

export default function Investing() {
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

  const alloc = d.allocation.map((r) => ({ region: String(r.region), pct: Number(r.pct) }));
  const usAlloc = alloc.find((a) => a.region === "US")?.pct ?? 0;

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
        <h1 className="text-2xl font-semibold">Investing</h1>
        {refreshed && <span className="text-xs text-zinc-500">Last refreshed {refreshed} ET</span>}
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Portfolio vs your ALTO framework. Signals only, not advice. Nothing here executes trades.
      </p>

      {/* signal grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Signal label="US equity" value={`${usPct}%`} target="50-65%" ok={usPct >= 50 && usPct <= 65} />
        <Signal label="Intl equity" value={`${intlPct}%`} target="35-50%" ok={intlPct >= 35 && intlPct <= 50} />
        <Signal label="Bonds" value={`${bondPct}%`} target="0%" ok={bondPct === 0} />
        <Signal label="VYMI (Active)" value={`${vymiPct}%`} target="25-35%" ok={vymiPct >= 25 && vymiPct <= 35} />
        <Signal label="Standard positions" value={`${stdPos}`} target="5-7" ok={stdPos >= 5 && stdPos <= 7} />
        <Signal label="Dry powder" value={`${dryPct}%`} target="flexible" ok={true} />
      </div>

      {/* geographic allocation bar */}
      <Card className="mt-3">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-zinc-400">Geographic split (equity)</span>
          <span className="text-zinc-300">US {usAlloc}% · Intl {100 - usAlloc}%</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div style={{ width: `${usAlloc}%`, background: GREEN }} />
          <div style={{ width: `${100 - usAlloc}%`, background: ACCENT }} />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: GREEN }} /> US
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: ACCENT }} /> International
          </span>
        </div>
      </Card>

      {/* positions vs caps */}
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
              {d.positions.map((p, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="py-1.5 pr-4">{p.ticker ? String(p.ticker) : "—"}</td>
                  <td className="py-1.5 pr-4 text-zinc-400">{String(p.sleeve)}</td>
                  <td className="py-1.5 pr-4">${Number(p.value).toLocaleString()}</td>
                  <td className="py-1.5 pr-4" style={{ color: p.over_cap ? RED : undefined }}>
                    {String(p.pct_of_active)}%
                  </td>
                  <td className="py-1.5">
                    {p.cap_pct ? (
                      <span style={{ color: p.over_cap ? RED : "#71717a" }}>
                        {p.over_cap ? "over" : "≤"} {String(p.cap_pct)}%
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-zinc-600">
        Macro regime + 5-indicator monitor coming next (needs a FRED API key).
      </p>
    </main>
  );
}
