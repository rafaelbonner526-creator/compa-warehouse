import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const [digest, history, plmOps] = await Promise.all([
      run(
        `SELECT severity, section, headline, detail, value
         FROM \`${P}.gold.mart_review_digest\` ORDER BY severity, ord, headline`,
      ),
      run(
        `SELECT * FROM \`${P}.gold.mart_review_snapshot\` ORDER BY snapshot_date DESC LIMIT 30`,
      ),
      // Appended LAST. Promise.all destructures POSITIONALLY, so a query
      // inserted anywhere else silently reassigns every variable after it.
      // Operational telemetry only: catalog aggregates and RAG eval metrics.
      // No patient data is in this warehouse, by construction.
      run(`SELECT * FROM \`${P}.gold.mart_plm_ops\``),
    ]);
    return NextResponse.json({ digest, history, plmOps });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
