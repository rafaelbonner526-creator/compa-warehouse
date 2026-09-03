"use client";

/* COMPA shared UI primitives.
   ------------------------------------------------------------------------
   WHY THIS FILE EXISTS. Card, Signal, fmt and a private colour constant were
   redefined in four page files with drifting values: GREEN was #34d399 on one
   page and #22c55e on another, and each page invented its own number formatting.
   The same class of duplication that put two hardcoded mart lists out of sync.
   One definition, imported everywhere.

   COLOURS COME FROM CSS TOKENS, never hex literals in a component. The token set
   in globals.css was validated with the dataviz validator against the chart
   surface; a hex typed into a component escapes that check entirely. */

import * as React from "react";

export type Row = Record<string, string | number | null>;

export const SERIES = [
  "var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)",
  "var(--series-5)", "var(--series-6)", "var(--series-7)", "var(--series-8)",
] as const;

/** Fixed order, never cycled. A 9th series folds into Other or becomes small
 *  multiples: a generated hue would not have been validated for CVD. */
export function seriesColor(i: number): string {
  return SERIES[Math.min(i, SERIES.length - 1)];
}

export const STATUS = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
} as const;
export type StatusKey = keyof typeof STATUS;

/* ---------------------------------------------------------------- formatting */

export const usd = (v: number, cents = false) =>
  cents
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(v).toLocaleString("en-US")}`;

export const pct = (v: number, dp = 0) => `${v.toFixed(dp)}%`;

/** Compact for axes only. Never for a headline: "1.6K" hides the number the
 *  reader came for. */
export const compact = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : String(Math.round(v));

export const num = (v: unknown, fallback = 0): number =>
  v == null || v === "" ? fallback : Number(v);

/* -------------------------------------------------------------------- layout */

export function Page({ title, subtitle, actions, children }: {
  title: string; subtitle?: string;
  actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-2">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-4">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children}
    </main>
  );
}

export function Grid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={`grid grid-cols-1 gap-3 ${c}`}>{children}</div>;
}

export function Card({ title, hint, right, className = "", children }: {
  title?: string; hint?: string; right?: React.ReactNode;
  className?: string; children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[var(--radius)] border p-5 ${className}`}
      style={{ background: "var(--surface-1)", borderColor: "var(--surface-3)" }}
    >
      {(title || right) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{title}</h2>}
            {hint && <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- stat tiles */

/** A single headline number. Per the form heuristic, one value with no
 *  comparison is a tile, not a chart: a bar of length one communicates nothing. */
export function Stat({ label, value, delta, deltaLabel, status, hint }: {
  label: string; value: string;
  delta?: number; deltaLabel?: string;
  status?: StatusKey; hint?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card>
      <div className="flex items-center gap-2">
        {status && (
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS[status] }} />
        )}
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div className="tnum mt-1.5 text-[28px] font-semibold leading-none tracking-tight">{value}</div>
      {delta !== undefined && (
        <div className="tnum mt-1.5 text-xs" style={{ color: up ? "var(--status-good)" : "var(--status-critical)" }}>
          {up ? "▲" : "▼"} {deltaLabel ?? Math.abs(delta).toString()}
        </div>
      )}
      {hint && <div className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{hint}</div>}
    </Card>
  );
}

/* -------------------------------------------------------------- interactions */

/** Filters live in ONE row above the charts, never scattered between them. */
export function Segmented<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[]; ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel}
      className="inline-flex rounded-full p-0.5"
      style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: on ? "var(--surface-0)" : "transparent",
              color: on ? "var(--text-primary)" : "var(--text-muted)",
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Shared Recharts tooltip. Values wear text tokens; the coloured dot beside a
 *  label carries identity, so meaning never rests on colour alone. */
export function Tip({ active, payload, label, format }: {
  active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number; format?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)", color: "var(--text-primary)" }}>
      {label !== undefined && (
        <div className="mb-1 font-medium" style={{ color: "var(--text-secondary)" }}>{String(label)}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 whitespace-nowrap">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "var(--text-muted)" }}>{p.name}</span>
          <span className="tnum ml-auto font-medium">
            {typeof p.value === "number" && format ? format(p.value) : String(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- tables */

export function Table({ head, children, dense = false }: {
  head: string[]; children: React.ReactNode; dense?: boolean;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-full text-xs">
        <thead>
          <tr style={{ color: "var(--text-muted)" }}>
            {head.map((h, i) => (
              <th key={i} className={`${dense ? "py-1" : "py-1.5"} px-1 font-normal ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="transition-colors hover:bg-[var(--surface-2)]"
        style={{ borderTop: "1px solid var(--surface-3)" }}>
      {children}
    </tr>
  );
}

export function Td({ children, align = "right", color, mono = true }: {
  children: React.ReactNode; align?: "left" | "right";
  color?: string; mono?: boolean;
}) {
  return (
    <td className={`px-1 py-1.5 ${align === "left" ? "text-left" : "text-right"} ${mono ? "tnum" : ""}`}
        style={{ color: color ?? "var(--text-secondary)" }}>
      {children}
    </td>
  );
}

/** A meter, for a value against a bound. 4px rounded ends anchored to the
 *  baseline; the track recedes toward the surface. */
export function Meter({ value, max, color, label }: {
  value: number; max: number; color?: string; label?: string;
}) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
        <div className="h-full rounded-full transition-[width] duration-500"
             style={{ width: `${w}%`, background: color ?? "var(--series-1)" }} />
      </div>
      {label && <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>{children}</div>;
}
