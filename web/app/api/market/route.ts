import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const [indicators, regime, history, meta] = await Promise.all([
      run(
        `SELECT series, latest_value, change_90d_pct, direction FROM \`${P}.gold.mart_macro_indicators\``,
      ),
      run(`SELECT * FROM \`${P}.gold.mart_macro_regime\``),
      run(
        `SELECT series, obs_date, value FROM \`${P}.gold.mart_macro_history\` ORDER BY obs_date`,
      ),
      run(`SELECT max(inserted_at) AS refreshed_at FROM \`${P}.bronze._dlt_loads\``),
    ]);
    return NextResponse.json({
      indicators,
      regime: regime[0] ?? null,
      history,
      refreshed_at: meta[0]?.refreshed_at ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
