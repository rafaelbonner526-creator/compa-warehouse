#!/bin/bash
# Daily cloud refresh: pull Monarch + leads + FRED into BigQuery, then dbt build.
set -euo pipefail
cd /Users/rafaelbonner/Projects/compa-warehouse
set -a; source .env; set +a
export WAREHOUSE_TARGET=bigquery
UV=/opt/homebrew/bin/uv
MONARCH_PY=/Users/rafaelbonner/.venvs/monarch-mcp/bin/python
echo "=== refresh $(date) ==="
"$MONARCH_PY" ingestion/extract_monarch.py
"$UV" run ingestion/load_finance.py
"$UV" run ingestion/extract_fred.py
"$UV" run ingestion/load_macro.py
"$UV" run ingestion/load_bronze_dlt.py
"$UV" run dbt build --target prod --profiles-dir .
echo "=== done $(date) ==="
