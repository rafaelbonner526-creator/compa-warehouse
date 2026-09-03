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
        className="w-full max-w-xs rounded-2xl border bd-s3 bg-s1 p-6"
      >
        <h1 className="text-lg font-semibold">COMPA Budget</h1>
        <p className="mt-1 text-sm tx-m">Enter password to continue.</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          className="mt-4 w-full rounded-lg border bd-s3 bg-s0 px-3 py-2 tx-1 outline-none focus:bd-s3"
          placeholder="Password"
        />
        {err && <p className="mt-2 text-sm tx-crit">Wrong password.</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg btn-primary py-2 font-medium tx-1 disabled:opacity-60"
        >
          {busy ? "…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
