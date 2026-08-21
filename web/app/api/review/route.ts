import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const [digest, history] = await Promise.all([
      run(
        `SELECT severity, section, headline, detail, value
         FROM \`${P}.gold.mart_review_digest\` ORDER BY severity, ord, headline`,
      ),
      run(
        `SELECT * FROM \`${P}.gold.mart_review_snapshot\` ORDER BY snapshot_date DESC LIMIT 30`,
      ),
    ]);
    return NextResponse.json({ digest, history });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
