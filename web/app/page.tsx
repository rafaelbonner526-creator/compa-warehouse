"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GREEN = "#34d399";
const RED = "#f87171";
const ACCENT = "#818cf8";

const money = (x: number | string) =>
  `$${Math.round(Number(x)).toLocaleString("en-US")}`;

type Row = Record<string, string | number | null>;
type Data = {
  sts: Row;
  networth: Row[];
  cashflow: Row[];
  categories: Row[];
  bills: Row[];
  recent: Row[];
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <Card>
      <div className="text-sm text-zinc-400">{label}</div>
      <div
        className="mt-1 text-3xl font-semibold tracking-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </Card>
  );
}

const tip = {
  contentStyle: {
    background: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: 12,
    color: "#fafafa",
  },
  labelStyle: { color: "#a1a1aa" },
};

export default function Home() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/budget")
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setD(j)))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <main className="p-8 text-red-400">Error: {err}</main>;
  if (!d) return <main className="p-8 text-zinc-500">Loading…</main>;

  const s = d.sts;
  const left = Number(s.safe_to_spend_month);
  const budget = Number(s.living_target);
  const spent = Number(s.spent_this_month);
  const nwNow = d.networth.length
    ? Number(d.networth[d.networth.length - 1].net_worth)
    : 0;
  const pct = budget ? Math.min((spent / budget) * 100, 100) : 0;

  const nw = d.networth.map((r) => ({
    date: String(r.snapshot_date).slice(5),
    v: Number(r.net_worth),
  }));
  const cf = [...d.cashflow]
    .reverse()
    .map((r) => ({ month: String(r.month).slice(0, 7).slice(5), net: Number(r.net) }));
  const cats = d.categories.map((r) => ({
    name: String(r.category_group),
    spend: Number(r.spend),
  }));

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold">Budget</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Living budget = 70% of W2 take-home. Not financial advice.
      </p>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Left to spend"
          value={money(left)}
          accent={left >= 0 ? GREEN : RED}
          sub="this month"
        />
        <Kpi
          label="Daily allowance"
          value={money(Math.max(left, 0) / 10)}
          sub="pace for the rest of the month"
        />
        <Kpi label="Spent this month" value={money(spent)} />
        <Kpi label="Net worth" value={money(nwNow)} accent={GREEN} />
      </div>

      {/* budget progress */}
      <Card className="mt-3">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">This month</span>
          <span className="text-zinc-300">
            {money(spent)} of {money(budget)}
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: pct >= 100 ? RED : GREEN,
            }}
          />
        </div>
      </Card>

      {/* charts */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">Net worth</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={nw} margin={{ left: -12, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={40} />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                width={44}
              />
              <Tooltip {...tip} formatter={(v) => money(Number(v))} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={GREEN}
                strokeWidth={2}
                fill="url(#nw)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">
            Cash flow (net by month)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cf} margin={{ left: -12, right: 8, top: 4 }}>
              <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                width={44}
              />
              <Tooltip {...tip} cursor={{ fill: "#27272a55" }} formatter={(v) => money(Number(v))} />
              <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                {cf.map((r, i) => (
                  <Cell key={i} fill={r.net >= 0 ? GREEN : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* category spend */}
      <Card className="mt-3">
        <div className="mb-3 text-sm font-medium text-zinc-300">
          Spending by category (this month)
        </div>
        <ResponsiveContainer width="100%" height={Math.max(cats.length * 34, 120)}>
          <BarChart data={cats} layout="vertical" margin={{ left: 40, right: 24 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              width={120}
            />
            <Tooltip {...tip} cursor={{ fill: "#27272a55" }} formatter={(v) => money(Number(v))} />
            <Bar dataKey="spend" fill={ACCENT} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* lists */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">Upcoming bills</div>
          <ul className="space-y-2 text-sm">
            {d.bills.map((b, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-zinc-300">{String(b.merchant)}</span>
                <span className="text-zinc-400">
                  {String(b.due_date).slice(5)} · {money(Number(b.amount))}
                </span>
              </li>
            ))}
            {!d.bills.length && <li className="text-zinc-500">None upcoming</li>}
          </ul>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">
            Recent transactions
          </div>
          <ul className="space-y-2 text-sm">
            {d.recent.map((t, i) => {
              const amt = Number(t.amount);
              return (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate text-zinc-300">{String(t.merchant)}</span>
                  <span style={{ color: amt > 0 ? GREEN : "#a1a1aa" }}>
                    {amt > 0 ? "+" : "−"}
                    {money(Math.abs(amt))}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </main>
  );
}
