import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const [kpi, funnel, status, meta] = await Promise.all([
      run(
        `SELECT
           (SELECT count(*) FROM \`${P}.silver.stg_leads\`) AS leads,
           (SELECT count(*) FROM \`${P}.gold.fact_touch\`)  AS touches,
           (SELECT round(sum(is_open)  * 100.0 / count(*), 1) FROM \`${P}.gold.fact_touch\`) AS open_rate,
           (SELECT round(sum(is_reply) * 100.0 / count(*), 1) FROM \`${P}.gold.fact_touch\`) AS reply_rate`,
      ),
      run(
        `SELECT angle, total_touches, opens, replies, open_rate_pct, reply_rate_pct
         FROM \`${P}.gold.mart_outreach_funnel\` ORDER BY total_touches DESC`,
      ),
      run(
        `SELECT status, count(*) AS leads FROM \`${P}.silver.scd_leads\`
         WHERE dbt_valid_to IS NULL GROUP BY status ORDER BY leads DESC LIMIT 10`,
      ),
      run(`SELECT max(inserted_at) AS refreshed_at FROM \`${P}.bronze._dlt_loads\``),
    ]);

    return NextResponse.json({
      kpi: kpi[0],
      funnel,
      status,
      refreshed_at: meta[0]?.refreshed_at ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
