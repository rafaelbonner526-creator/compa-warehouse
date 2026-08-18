#!/bin/bash
# Daily cloud refresh: load bronze from the vault CSVs into BigQuery, then dbt build.
# Triggered by launchd (com.compa.warehouse-refresh). Laptop-local because the
# leads source originates locally; cloud-API domains will use GitHub Actions instead.
set -euo pipefail
cd /Users/rafaelbonner/Projects/compa-warehouse
set -a; source .env; set +a
export WAREHOUSE_TARGET=bigquery
echo "=== refresh $(date) ==="
"/opt/homebrew/bin/uv" run ingestion/load_bronze_dlt.py
"/opt/homebrew/bin/uv" run dbt build --target prod --profiles-dir .
echo "=== done $(date) ==="
