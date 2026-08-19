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
      refreshed_at: meta[0]?.refreshed_at ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
