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
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${money(Math.abs(x))}`;

type Row = Record<string, string | number | null>;
type Data = {
  sts: Row;
  networth: Row[];
  breakdown: Row[];
  cashflow: Row[];
  categories: Row[];
  categoryTrend: Row[];
  merchants: Row[];
  bills: Row[];
  recent: Row[];
  runway: Row | null;
  recurring: Row | null;
  refreshed_at: string | null;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>
      {children}
    </div>
  );
}

function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <Card>
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </Card>
  );
}

const tip = {
  contentStyle: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fafafa" },
  labelStyle: { color: "#a1a1aa" },
};

const Dot = ({ c }: { c: string }) => (
  <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
);

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
  const pctSpent = budget ? Math.min((spent / budget) * 100, 100) : 0;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth + 1;
  const dailyAllowance = Math.max(left, 0) / daysLeft;
  const projected = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : spent;
  const projOver = projected - budget;

  const nw = d.networth.map((r) => ({ date: String(r.snapshot_date).slice(5), v: Number(r.net_worth) }));
  const nwNow = nw.length ? nw[nw.length - 1].v : 0;
  const nwPrior = nw.length > 30 ? nw[nw.length - 31].v : nw.length ? nw[0].v : 0;
  const nwChange = nwNow - nwPrior;
  const breakdown = d.breakdown.map((r) => ({ bucket: String(r.bucket), balance: Number(r.balance) }));

  const cf = [...d.cashflow].reverse().map((r) => ({
    month: String(r.month).slice(5, 7),
    income: Number(r.income),
    spend: Number(r.spend),
    net: Number(r.net),
  }));
  const curMonth = d.cashflow[0] ?? {};
  const curIncome = Number(curMonth.income ?? 0);
  const curSpend = Number(curMonth.spend ?? 0);

  // trailing 3 complete months avg savings rate
  const complete = d.cashflow.slice(1, 4);
  const savingsRate = complete.length
    ? Math.round(complete.reduce((a, r) => a + Number(r.savings_rate_pct ?? 0), 0) / complete.length)
    : 0;

  const cats = d.categories.map((r) => ({ name: String(r.category_group), spend: Number(r.spend) }));
  const catTotal = cats.reduce((a, c) => a + c.spend, 0);

  const runwayMonths = d.runway ? Number(d.runway.runway_months) : 0;
  const liquid = d.runway ? Number(d.runway.liquid_savings) : 0;
  const recurringMo = d.recurring ? Number(d.recurring.monthly_recurring) : 0;
  const recurringN = d.recurring ? Number(d.recurring.bills) : 0;

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
        <h1 className="text-2xl font-semibold">Budget</h1>
        {refreshed && <span className="text-xs text-zinc-500">Last refreshed {refreshed} ET</span>}
      </div>
      <p className="mt-1 text-sm text-zinc-500">Living budget = 70% of W2 take-home. Not financial advice.</p>

      {/* KPI row 1 */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Left to spend" value={money(left)} accent={left >= 0 ? GREEN : RED} sub="this month" />
        <Kpi label="Daily allowance" value={money(dailyAllowance)} sub={`${daysLeft} days left`} />
        <Kpi label="Spent this month" value={money(spent)} sub={`of ${money(budget)}`} />
        <Kpi label="Net worth" value={money(nwNow)} accent={GREEN} sub={`${signed(nwChange)} · 30d`} />
      </div>

      {/* KPI row 2 */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Savings rate"
          value={`${savingsRate}%`}
          accent={savingsRate >= 0 ? GREEN : RED}
          sub="avg, last 3 months"
        />
        <Kpi
          label="Runway"
          value={`${runwayMonths} mo`}
          accent={runwayMonths < 3 ? RED : GREEN}
          sub={`${money(liquid)} liquid`}
        />
        <Kpi label="Recurring" value={`${money(recurringMo)}/mo`} sub={`${recurringN} bills`} />
        <Kpi label="Income this month" value={money(curIncome)} sub="W2 + freelance" />
      </div>

      {/* budget progress + forecast */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Spent this month</span>
            <span className="text-zinc-300">{money(spent)} of {money(budget)}</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full" style={{ width: `${pctSpent}%`, background: pctSpent >= 100 ? RED : GREEN }} />
          </div>
        </Card>
        <Card>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Projected month-end spend</span>
            <span className="font-medium" style={{ color: projOver > 0 ? RED : GREEN }}>{money(projected)}</span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {projOver > 0
              ? `On pace to go ${money(projOver)} over your ${money(budget)} budget`
              : `On pace to finish ${money(-projOver)} under your ${money(budget)} budget`}
          </div>
        </Card>
      </div>

      {/* net worth + cash flow */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm font-medium text-zinc-300">Net worth</span>
            <span>
              <span className="text-lg font-semibold">{money(nwNow)}</span>
              <span className="ml-2 text-xs" style={{ color: nwChange >= 0 ? GREEN : RED }}>{signed(nwChange)} · 30d</span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={nw} margin={{ left: -12, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={40} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} width={44} />
              <Tooltip {...tip} formatter={(v) => money(Number(v))} />
              <Area type="monotone" dataKey="v" stroke={GREEN} strokeWidth={2} fill="url(#nw)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm font-medium text-zinc-300">Income vs spend (by month)</span>
            <span className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1"><Dot c={GREEN} /> income</span>
              <span className="flex items-center gap-1"><Dot c={RED} /> spend</span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={cf} margin={{ left: -12, right: 8, top: 4 }}>
              <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} width={44} />
              <Tooltip {...tip} cursor={{ fill: "#27272a55" }} formatter={(v) => money(Number(v))} />
              <Bar dataKey="income" fill={GREEN} radius={[3, 3, 0, 0]} />
              <Bar dataKey="spend" fill={RED} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* net worth breakdown */}
      <Card className="mt-3">
        <div className="mb-3 text-sm font-medium text-zinc-300">Net worth breakdown</div>
        <div className="grid grid-cols-3 gap-3">
          {breakdown.map((b) => (
            <div key={b.bucket}>
              <div className="text-xs text-zinc-500">{b.bucket}</div>
              <div
                className="text-xl font-semibold"
                style={{ color: b.balance >= 0 ? GREEN : RED }}
              >
                {money(b.balance)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* category spend */}
      <Card className="mt-3">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-medium text-zinc-300">Spending by category (this month)</span>
          <span className="text-lg font-semibold">{money(catTotal)}</span>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(cats.length * 34, 120)}>
          <BarChart data={cats} layout="vertical" margin={{ left: 40, right: 48 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} width={120} />
            <Tooltip {...tip} cursor={{ fill: "#27272a55" }} formatter={(v) => money(Number(v))} />
            <Bar dataKey="spend" fill={ACCENT} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* category trend + top merchants */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">This month vs 3-month average</div>
          <ul className="space-y-2 text-sm">
            {d.categoryTrend.map((r, i) => {
              const delta = Number(r.delta);
              return (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-zinc-300">{String(r.category_group)}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-zinc-200">{money(Number(r.this_month))}</span>
                    <span className="w-20 text-right text-xs" style={{ color: delta > 0 ? RED : GREEN }}>
                      {delta > 0 ? "▲" : "▼"} {money(Math.abs(delta))}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">Top merchants (30d)</div>
          <ul className="space-y-2 text-sm">
            {d.merchants.map((m, i) => (
              <li key={i} className="flex justify-between">
                <span className="truncate text-zinc-300">{String(m.merchant)}</span>
                <span className="text-zinc-400">{money(Number(m.spend))}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* bills + recent */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">Upcoming bills</div>
          <ul className="space-y-2 text-sm">
            {d.bills.map((b, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-zinc-300">{String(b.merchant)}</span>
                <span className="text-zinc-400">{String(b.due_date).slice(5)} · {money(Number(b.amount))}</span>
              </li>
            ))}
            {!d.bills.length && <li className="text-zinc-500">None upcoming</li>}
          </ul>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">Recent transactions</div>
          <ul className="space-y-2 text-sm">
            {d.recent.map((t, i) => {
              const amt = Number(t.amount);
              return (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate text-zinc-300">{String(t.merchant)}</span>
                  <span style={{ color: amt > 0 ? GREEN : "#a1a1aa" }}>{signed(amt)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </main>
  );
}
