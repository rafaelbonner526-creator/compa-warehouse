"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();
  if (path === "/login") return null;

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm ${
        path === href
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="mx-auto flex max-w-5xl gap-1 px-5 pt-6">
      {link("/", "Budget")}
      {link("/investing", "Portfolio")}
      {link("/market", "Market")}
      {link("/outreach", "Outreach")}
      {link("/review", "Review")}
    </nav>
  );
}
