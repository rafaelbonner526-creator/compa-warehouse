"""compa-warehouse serving dashboard.

Reads the gold marts straight from DuckDB and renders the outreach funnel.
This is the "serving layer": the daily view on top of the whole pipeline.

Run:  uv run streamlit run dashboard/app.py
"""

from pathlib import Path

import duckdb
import streamlit as st

WAREHOUSE = Path(__file__).parent.parent / "data" / "warehouse.duckdb"

st.set_page_config(page_title="COMPA Warehouse", layout="wide")
st.title("Outreach funnel")
st.caption("Live from the gold marts, built by the compa-warehouse pipeline.")

# read_only so this never fights the pipeline for the write lock
con = duckdb.connect(str(WAREHOUSE), read_only=True)

# --- KPI row -------------------------------------------------------------
kpis = con.sql(
    """
    SELECT
        (SELECT count(*) FROM silver.stg_leads)                          AS leads,
        (SELECT count(*) FROM gold.fact_touch)                           AS touches,
        (SELECT round(sum(is_open)  * 100.0 / count(*), 1) FROM gold.fact_touch) AS open_rate,
        (SELECT round(sum(is_reply) * 100.0 / count(*), 1) FROM gold.fact_touch) AS reply_rate
    """
).fetchone()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Leads", kpis[0])
c2.metric("Touches", kpis[1])
c3.metric("Open rate", f"{kpis[2]}%")
c4.metric("Reply rate", f"{kpis[3]}%")

# --- Funnel by angle -----------------------------------------------------
mart = con.sql(
    "SELECT * FROM gold.mart_outreach_funnel ORDER BY total_touches DESC"
).df()

st.subheader("Reply rate by angle")
st.bar_chart(mart, x="angle", y="reply_rate_pct")

st.subheader("Full funnel")
st.dataframe(mart, use_container_width=True, hide_index=True)
