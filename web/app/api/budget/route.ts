import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

const P = "compa-warehouse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBQ() {
  const key = process.env.GCP_SA_KEY;
  if (!key) throw new Error("GCP_SA_KEY not set");
  const creds = JSON.parse(key);
  return new BigQuery({ projectId: creds.project_id, credentials: creds });
}

// BigQuery wraps DATE/TIMESTAMP/NUMERIC in { value }; flatten to primitives.
function clean(rows: Record<string, unknown>[]) {
  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => {
        if (v && typeof v === "object" && "value" in (v as object)) {
          return [k, (v as { value: unknown }).value];
        }
        return [k, v];
      }),
    ),
  );
}

export async function GET() {
  try {
    const bq = getBQ();
    const run = async (sql: string) =>
      clean((await bq.query({ query: sql, location: "US" }))[0]);

    const [sts, networth, cashflow, categories, bills, recent, meta] = await Promise.all([
      run(`SELECT * FROM \`${P}.gold.mart_safe_to_spend\``),
      run(
        `SELECT snapshot_date, net_worth FROM \`${P}.gold.mart_networth\` ORDER BY snapshot_date`,
      ),
      run(
        `SELECT month, income, spend, net FROM \`${P}.gold.mart_monthly_cashflow\` ORDER BY month DESC LIMIT 8`,
      ),
      run(
        `SELECT category_group, spend FROM \`${P}.gold.mart_spend_by_category\`
         WHERE month = (SELECT max(month) FROM \`${P}.gold.mart_spend_by_category\`)
         ORDER BY spend DESC LIMIT 8`,
      ),
      run(
        `SELECT due_date, merchant, round(abs(amount)) AS amount FROM \`${P}.silver.stg_recurring\`
         WHERE due_date >= current_date() ORDER BY due_date LIMIT 6`,
      ),
      run(
        `SELECT txn_date, merchant, category, round(amount) AS amount FROM \`${P}.silver.stg_transactions\`
         WHERE NOT hide_from_reports ORDER BY txn_date DESC LIMIT 10`,
      ),
      run(`SELECT max(inserted_at) AS refreshed_at FROM \`${P}.bronze._dlt_loads\``),
    ]);

    return NextResponse.json({
      sts: sts[0],
      networth,
      cashflow,
      categories,
      bills,
      recent,
      refreshed_at: meta[0]?.refreshed_at ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
