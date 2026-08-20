import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const [
      indicators,
      regime,
      history,
      allWeather,
      equilibrium,
      bigCycle,
      propertyCycle,
      evidenceBands,
      housePrices,
      declineSignals,
      newsClimate,
      valuation,
      valuationRef,
      creditCycle,
      cycleIntervals,
      meta,
    ] = await Promise.all([
      run(
        `SELECT series, latest_value, change_90d_pct, direction FROM \`${P}.gold.mart_macro_indicators\``,
      ),
      run(`SELECT * FROM \`${P}.gold.mart_macro_regime\``),
      run(
        `SELECT series, obs_date, value FROM \`${P}.gold.mart_macro_history\` ORDER BY obs_date`,
      ),
      run(`SELECT * FROM \`${P}.gold.mart_all_weather\` ORDER BY box_order`),
      run(`SELECT * FROM \`${P}.gold.mart_macro_equilibrium\``),
      run(`SELECT * FROM \`${P}.gold.mart_big_cycle\` ORDER BY stage_order`),
      run(`SELECT * FROM \`${P}.gold.mart_property_cycle\``),
      run(`SELECT * FROM \`${P}.gold.mart_evidence_bands\` ORDER BY scope_order`),
      run(
        `SELECT obs_date, value FROM \`${P}.gold.mart_house_price_history\` ORDER BY obs_date`,
      ),
      run(
        `SELECT * FROM \`${P}.gold.mart_debasement_signals\` ORDER BY criterion_order`,
      ),
      run(`SELECT * FROM \`${P}.gold.mart_news_climate\` ORDER BY ord`),
      run(`SELECT * FROM \`${P}.gold.mart_valuation\``),
      run(`SELECT * FROM \`${P}.gold.mart_valuation_reference\` ORDER BY ord`),
      run(`SELECT * FROM \`${P}.gold.mart_credit_cycle\` WHERE entity = 'USA'`),
      // Bucketed rather than one bar per year. 83 intervals spread over 6-41 years
      // rendered as ~30 sparse bars that read as noise; five buckets centred on the
      // model's own 16-20 claim answer the question at a glance.
      run(
        `SELECT bucket, sort_key, count(*) AS n FROM (
           SELECT
             CASE
               WHEN interval_years < 12 THEN '6-11'
               WHEN interval_years < 16 THEN '12-15'
               WHEN interval_years <= 20 THEN '16-20'
               WHEN interval_years <= 25 THEN '21-25'
               ELSE '26+'
             END AS bucket,
             CASE
               WHEN interval_years < 12 THEN 1
               WHEN interval_years < 16 THEN 2
               WHEN interval_years <= 20 THEN 3
               WHEN interval_years <= 25 THEN 4
               ELSE 5
             END AS sort_key
           FROM \`${P}.gold.mart_property_cycle_intervals\`
           WHERE interval_years IS NOT NULL
         ) t GROUP BY bucket, sort_key ORDER BY sort_key`,
      ),
      run(`SELECT max(inserted_at) AS refreshed_at FROM \`${P}.bronze._dlt_loads\``),
    ]);
    return NextResponse.json({
      indicators,
      regime: regime[0] ?? null,
      history,
      allWeather,
      equilibrium: equilibrium[0] ?? null,
      bigCycle,
      propertyCycle: propertyCycle[0] ?? null,
      evidenceBands,
      housePrices,
      declineSignals,
      newsClimate,
      valuation: valuation[0] ?? null,
      valuationRef,
      creditCycle: creditCycle[0] ?? null,
      cycleIntervals,
      refreshed_at: meta[0]?.refreshed_at ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
