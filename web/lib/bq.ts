import { BigQuery } from "@google-cloud/bigquery";

export const P = "compa-warehouse";

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

export function makeRunner() {
  const bq = getBQ();
  return async (sql: string) =>
    clean((await bq.query({ query: sql, location: "US" }))[0]);
}
