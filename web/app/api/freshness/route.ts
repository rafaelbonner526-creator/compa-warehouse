import { NextResponse } from "next/server";
import { P, makeRunner } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const run = makeRunner();
    const rows = await run(
      `SELECT * FROM \`${P}.gold.mart_data_freshness\` ORDER BY ord`,
    );
    return NextResponse.json({ sources: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
