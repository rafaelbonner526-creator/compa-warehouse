import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Freshness from "@/components/Freshness";

// globals.css referenced --font-geist-sans for months and nothing ever loaded it,
// so the whole dashboard rendered in Arial. Loading it here is what makes the
// token real.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "COMPA",
  description: "Personal finance + outreach dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <Nav />
        <Freshness />
        {children}
      </body>
    </html>
  );
}
