import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const [signals, allocation, positions, macro, regime, meta] = await Promise.all([
      run(`SELECT * FROM \`${P}.gold.mart_portfolio_signals\``),
      run(`SELECT region, value, pct FROM \`${P}.gold.mart_allocation\``),
      run(
        `SELECT ticker, name, sleeve, value, pct_of_active, cap_pct, over_cap
         FROM \`${P}.gold.mart_positions\``,
      ),
      run(
        `SELECT series, latest_value, change_90d_pct, direction FROM \`${P}.gold.mart_macro_indicators\``,
      ),
      run(`SELECT * FROM \`${P}.gold.mart_macro_regime\``),
      run(`SELECT max(inserted_at) AS refreshed_at FROM \`${P}.bronze._dlt_loads\``),
    ]);

    return NextResponse.json({
      signals: signals[0],
      allocation,
      positions,
      macro,
      regime: regime[0] ?? null,
      refreshed_at: meta[0]?.refreshed_at ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
