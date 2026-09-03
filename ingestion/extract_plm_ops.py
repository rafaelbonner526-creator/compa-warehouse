"""PLM operational telemetry. NO PATIENT DATA, by construction.

Two sources, both free of anything attributable to a person:

  db_health        Postgres catalog aggregates via the ops_db_health() RPC:
                   sizes, tuple counts, index usage, connections. Added in PLM
                   migration 044, granted to service_role only.
  retrieval_runs   the RAG eval time series. Engineering metrics over a fixed
                   golden set of synthetic queries; no member ever appears.

WHY NOTHING ELSE. assessment_jobs and assessment_attempts carry email,
full_name, payload, responses, ai_results and domain_scores. Copying those into
BigQuery would put PHI in a system with no BAA. With 13 members, even a
de-identified row carrying a completion date can re-identify someone, so
row-level export is excluded too, not just the obvious identifier columns.
If a future metric needs patient-derived data, aggregate it inside Postgres and
export the aggregate, never the rows.

Run:  uv run ingestion/extract_plm_ops.py
"""

import csv
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

PLM_ENV = Path("/Users/rafaelbonner/Projects/PLM/.env")
RETRIEVAL_CSV = Path(
    "/Users/rafaelbonner/Projects/PLM/tests/evals/runs/timeseries.csv")
LAND = Path(os.getenv(
    "PLM_OPS_LANDING_DIR",
    str(Path(__file__).parent.parent / "data" / "raw" / "plm_ops"),
))


def _plm_env():
    env = {}
    for line in PLM_ENV.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_db_health(env):
    url = f"{env['SUPABASE_URL']}/rest/v1/rpc/ops_db_health"
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    rq = urllib.request.Request(
        url, data=b"{}", method="POST",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=30) as r:
        return json.loads(r.read())


def read_retrieval_runs():
    """Rows with no timestamp are DROPPED, not loaded.

    The upstream appender wrote literal blank rows for three months because it
    globbed the wrong eval file and swallowed the schema mismatch. That is fixed
    in PLM, but a blank row already in the file must never reach a chart: it
    renders as a real measurement at zero.
    """
    if not RETRIEVAL_CSV.exists():
        print(f"  retrieval: MISSING {RETRIEVAL_CSV}", file=sys.stderr)
        return []
    out, skipped = [], 0
    with RETRIEVAL_CSV.open() as f:
        for row in csv.DictReader(f):
            if not (row.get("run_timestamp") or "").strip():
                skipped += 1
                continue
            out.append(row)
    if skipped:
        print(f"  retrieval: dropped {skipped} row(s) with no timestamp")
    return out


def main():
    LAND.mkdir(parents=True, exist_ok=True)
    env = _plm_env()

    try:
        health = fetch_db_health(env)
        (LAND / "db_health.json").write_text(json.dumps([health]))
        print(f"  db_health -> 1 snapshot "
              f"({health['db_size_bytes'] / 1e6:.0f} MB, "
              f"{health['unused_indexes']} unused indexes)")
    except urllib.error.HTTPError as e:
        # Loud, not silent. A missing snapshot must not read as a healthy zero.
        print(f"  db_health: FAILED HTTP {e.code}. If 404, PLM migration 044 "
              f"is not applied to this project.", file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"  db_health: FAILED {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    runs = read_retrieval_runs()
    (LAND / "retrieval_runs.json").write_text(json.dumps(runs))
    print(f"  retrieval_runs -> {len(runs)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
