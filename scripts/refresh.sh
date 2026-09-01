#!/bin/bash
# Daily cloud refresh: pull Monarch + leads + FRED into BigQuery, then dbt build.
#
# WATCHDOG (added 2026-09-01)
# --------------------------
# This job hung THREE times in 13 logged runs (Aug 23, Aug 26, Aug 31) and the
# Aug 31 hang ran for 35 HOURS before being killed by hand. It stalled at dbt
# model 53 of 68 while urllib3 retried a GCP IAM `allowedLocations` call that
# kept returning RemoteDisconnected. Nothing bounded it.
#
# The cost is not just the missed refresh: launchd will not start a second
# instance while one is running, so a single hang silently cancels every
# subsequent daily run. `cron_fleet_silent` then pages every couple of hours,
# which is how this was finally noticed, 57 hours in.
#
# TIMEOUT DERIVED FROM DATA, NOT GUESSED. Measured over every completed run in
# refresh.log: 4.3, 5.3, 16.3, 24.3, 30.8, 32.0, 41.6, 58.3, 58.9 and 107.6
# minutes. The Aug 30 run took 107.6 minutes AND SUCCEEDED, so any bound at or
# under 2 hours would kill healthy runs. 3 hours is ~1.7x the slowest good run
# and still 12x tighter than the hang it exists to stop.
#
# WHY JOB CONTROL RATHER THAN `kill -TERM -$$`. Tested 2026-09-01: killing the
# script's own PID leaves the `uv run dbt` child ORPHANED and still running,
# which is exactly the state we were trying to prevent. `set -m` puts the work
# in its own process group so the watchdog can signal the entire tree. Proven in
# isolation before shipping: the watchdog fired, the group died, and no orphan
# survived. There is no `timeout`/`gtimeout` binary on this machine.
set -euo pipefail
cd /Users/rafaelbonner/Projects/compa-warehouse
set -a; source .env; set +a
export WAREHOUSE_TARGET=bigquery
UV=/opt/homebrew/bin/uv
MONARCH_PY=/Users/rafaelbonner/.venvs/monarch-mcp/bin/python

MAX_RUNTIME_SECS="${MAX_RUNTIME_SECS:-10800}"   # 3h; see header

run_steps() {
  echo "=== refresh $(date) ==="
  "$MONARCH_PY" ingestion/extract_monarch.py
  "$UV" run ingestion/load_finance.py
  "$UV" run ingestion/extract_fred.py
  "$UV" run ingestion/load_macro.py
  "$UV" run ingestion/load_bronze_dlt.py
  "$UV" run dbt build --target prod --profiles-dir .
  echo "=== done $(date) ==="
  # Heartbeat is INSIDE the guarded block and last, so a timed-out or failed run
  # never reports success and `cron_fleet_silent` still fires.
  python3 /Users/rafaelbonner/COMPA/system/scripts/cron_heartbeat.py beat warehouse-refresh
}

set -m                 # background job becomes its own process-group leader
run_steps &
WORK_PID=$!
set +m

# The watchdog ALSO gets its own process group. Killing the subshell alone
# orphans its `sleep`, leaving a stray multi-hour process after every healthy
# run (observed in testing 2026-09-01). Signalling the group reaps both.
set -m
(
  sleep "$MAX_RUNTIME_SECS"
  echo "=== TIMEOUT: run exceeded ${MAX_RUNTIME_SECS}s, killing process group ${WORK_PID} ==="
  kill -TERM -"$WORK_PID" 2>/dev/null || true
  sleep 15
  kill -KILL -"$WORK_PID" 2>/dev/null || true
) &
WATCHDOG_PID=$!
set +m

rc=0
wait "$WORK_PID" || rc=$?
kill -TERM -"$WATCHDOG_PID" 2>/dev/null || kill "$WATCHDOG_PID" 2>/dev/null || true
wait "$WATCHDOG_PID" 2>/dev/null || true

if [ "$rc" -ne 0 ]; then
  echo "=== refresh FAILED rc=$rc $(date) ==="
fi
exit "$rc"
