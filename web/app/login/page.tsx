"use client";

import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(false);
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) {
      window.location.href = "/";
    } else {
      setErr(true);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
      >
        <h1 className="text-lg font-semibold">COMPA Budget</h1>
        <p className="mt-1 text-sm text-zinc-500">Enter password to continue.</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
          placeholder="Password"
        />
        {err && <p className="mt-2 text-sm text-red-400">Wrong password.</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-emerald-500 py-2 font-medium text-zinc-950 disabled:opacity-60"
        >
          {busy ? "…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
