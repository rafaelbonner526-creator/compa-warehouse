import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const [signals, allocation, positions, macro, regime, actions, bands, meta, baselines] =
      await Promise.all([
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
      run(`SELECT * FROM \`${P}.gold.mart_portfolio_actions\``),
      run(`SELECT * FROM \`${P}.gold.mart_evidence_bands\` ORDER BY scope_order`),
      run(`SELECT max(inserted_at) AS refreshed_at FROM \`${P}.bronze._dlt_loads\``),
      // Appended LAST on purpose. This array is destructured POSITIONALLY, so a
      // query inserted anywhere else silently reassigns every variable after it.
      // A first draft of this change put it at the top and would have handed the
      // page baseline rows as `signals`, allocation rows as `positions`, and
      // dropped refreshed_at, with no error anywhere.
      //
      // comparability travels with every row: a Federal Reserve percentile and a
      // consulting-rate blog must never render identically.
      run(
        `SELECT domain, metric_key, tier, baseline_value, current_value, standing,
                gap_to_tier, change_90d, change_90d_pct, comparability, population,
                source_name, source_url, as_of_year, caution
         FROM \`${P}.gold.mart_baseline_vs_actual\`
         ORDER BY domain, metric_key, baseline_value`,
      ),
    ]);

    return NextResponse.json({
      signals: signals[0],
      allocation,
      positions,
      macro,
      regime: regime[0] ?? null,
      actions,
      bands,
      baselines,
      refreshed_at: meta[0]?.refreshed_at ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
