"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ACCENT = "#818cf8";
const GREEN = "#34d399";

type Row = Record<string, string | number | null>;
type Data = {
  kpi: Row;
  funnel: Row[];
  status: Row[];
  refreshed_at: string | null;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>
      {children}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}

const tip = {
  contentStyle: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fafafa" },
  labelStyle: { color: "#a1a1aa" },
};

export default function Outreach() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/outreach")
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setD(j)))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <main className="p-8 text-red-400">Error: {err}</main>;
  if (!d) return <main className="p-8 text-zinc-500">Loading…</main>;

  const k = d.kpi;
  const byAngle = d.funnel.map((r) => ({
    angle: String(r.angle),
    reply: Number(r.reply_rate_pct),
  }));
  const byStatus = d.status.map((r) => ({ status: String(r.status), leads: Number(r.leads) }));

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
        <h1 className="text-2xl font-semibold">Outreach</h1>
        {refreshed && <span className="text-xs text-zinc-500">Last refreshed {refreshed} ET</span>}
      </div>
      <p className="mt-1 text-sm text-zinc-500">SIGNAL cold-outreach funnel.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Leads" value={String(k.leads)} />
        <Kpi label="Touches" value={String(k.touches)} />
        <Kpi label="Open rate" value={`${k.open_rate}%`} />
        <Kpi label="Reply rate" value={`${k.reply_rate}%`} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">Reply rate by angle</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byAngle} margin={{ left: -12, right: 8, top: 4 }}>
              <XAxis dataKey="angle" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={36} />
              <Tooltip {...tip} cursor={{ fill: "#27272a55" }} formatter={(v) => `${Number(v)}%`} />
              <Bar dataKey="reply" fill={ACCENT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-medium text-zinc-300">Leads by current status</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byStatus} layout="vertical" margin={{ left: 40, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="status" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={110} />
              <Tooltip {...tip} cursor={{ fill: "#27272a55" }} />
              <Bar dataKey="leads" fill={GREEN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mt-3">
        <div className="mb-3 text-sm font-medium text-zinc-300">Funnel by angle</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="py-1 pr-4">Angle</th>
                <th className="py-1 pr-4">Touches</th>
                <th className="py-1 pr-4">Opens</th>
                <th className="py-1 pr-4">Replies</th>
                <th className="py-1 pr-4">Open %</th>
                <th className="py-1">Reply %</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {d.funnel.map((r, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="py-1.5 pr-4">{String(r.angle)}</td>
                  <td className="py-1.5 pr-4">{String(r.total_touches)}</td>
                  <td className="py-1.5 pr-4">{String(r.opens)}</td>
                  <td className="py-1.5 pr-4">{String(r.replies)}</td>
                  <td className="py-1.5 pr-4">{String(r.open_rate_pct)}%</td>
                  <td className="py-1.5">{String(r.reply_rate_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
