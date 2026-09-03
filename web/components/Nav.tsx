"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Sticky, so navigation is reachable from the bottom of a long page without
   scrolling back up. The active tab is marked by an underline AND a text-colour
   change, never by colour alone. */
const TABS = [
  { href: "/", label: "Money" },
  { href: "/investing", label: "Portfolio" },
  { href: "/market", label: "Market" },
  { href: "/outreach", label: "Outreach" },
  { href: "/review", label: "Systems" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login") return null;

  return (
    <nav
      className="sticky top-0 z-40 mb-2 backdrop-blur"
      style={{
        background: "color-mix(in oklab, var(--surface-0) 88%, transparent)",
        borderBottom: "1px solid var(--surface-3)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-5">
        <span
          className="mr-3 select-none text-[13px] font-semibold tracking-[0.18em]"
          style={{ color: "var(--text-muted)" }}
        >
          COMPA
        </span>
        {TABS.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className="relative px-3 py-3 text-sm transition-colors"
              style={{ color: on ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              {t.label}
              <span
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-opacity"
                style={{ background: "var(--series-1)", opacity: on ? 1 : 0 }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
