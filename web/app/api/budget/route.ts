import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const [
      sts,
      networth,
      breakdown,
      cashflow,
      categories,
      categoryTrend,
      merchants,
      bills,
      recent,
      runway,
      recurring,
      budget,
      meta,
    ] = await Promise.all([
      run(`SELECT * FROM \`${P}.gold.mart_safe_to_spend\``),
      run(`SELECT snapshot_date, net_worth FROM \`${P}.gold.mart_networth\` ORDER BY snapshot_date`),
      run(`SELECT bucket, balance FROM \`${P}.gold.mart_networth_breakdown\``),
      run(
        `SELECT month, income, w2_income, other_income, spend, net, savings_rate_pct
         FROM \`${P}.gold.mart_monthly_cashflow\` ORDER BY month DESC LIMIT 8`,
      ),
      run(
        `SELECT category_group, spend FROM \`${P}.gold.mart_spend_by_category\`
         WHERE month = (SELECT max(month) FROM \`${P}.gold.mart_spend_by_category\`)
         ORDER BY spend DESC LIMIT 8`,
      ),
      run(`SELECT category_group, this_month, avg_3mo, delta FROM \`${P}.gold.mart_category_trend\` LIMIT 8`),
      run(`SELECT merchant, spend, txns FROM \`${P}.gold.mart_top_merchants\``),
      run(
        `SELECT due_date, merchant, round(abs(amount)) AS amount FROM \`${P}.silver.stg_recurring\`
         WHERE due_date >= current_date() ORDER BY due_date LIMIT 6`,
      ),
      run(
        `SELECT txn_date, merchant, category, round(amount) AS amount FROM \`${P}.silver.stg_transactions\`
         WHERE NOT hide_from_reports ORDER BY txn_date DESC LIMIT 10`,
      ),
      run(`SELECT * FROM \`${P}.gold.mart_runway\``),
      run(`SELECT * FROM \`${P}.gold.mart_recurring_summary\``),
      run(`SELECT * FROM \`${P}.gold.mart_budget_vs_actual\``),
      run(`SELECT max(inserted_at) AS refreshed_at FROM \`${P}.bronze._dlt_loads\``),
    ]);

    return NextResponse.json({
      sts: sts[0],
      networth,
      breakdown,
      cashflow,
      categories,
      categoryTrend,
      merchants,
      bills,
      recent,
      runway: runway[0] ?? null,
      recurring: recurring[0] ?? null,
      budget,
      refreshed_at: meta[0]?.refreshed_at ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
