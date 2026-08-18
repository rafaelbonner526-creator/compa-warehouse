"""compa-warehouse serving dashboard (BigQuery).

Reads the gold marts from BigQuery and renders the outreach funnel.

Credentials resolve in two ways so the same file works everywhere:
  - Streamlit Cloud: st.secrets["gcp_service_account"] (pasted in app secrets)
  - Local dev:       the key file at GOOGLE_APPLICATION_CREDENTIALS

Run local:  set -a; source .env; set +a; uv run streamlit run dashboard/app.py
"""

import os

import streamlit as st
from google.cloud import bigquery
from google.oauth2 import service_account

PROJECT = "compa-warehouse"

st.set_page_config(page_title="COMPA Warehouse", layout="wide")


@st.cache_resource
def get_client() -> bigquery.Client:
    """Service-account creds from Streamlit secrets (cloud) or key file (local)."""
    try:
        info = dict(st.secrets["gcp_service_account"])
        creds = service_account.Credentials.from_service_account_info(info)
        project = info.get("project_id", PROJECT)
    except Exception:
        creds = service_account.Credentials.from_service_account_file(
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
        )
        project = os.environ.get("GCP_PROJECT", PROJECT)
    return bigquery.Client(credentials=creds, project=project)


client = get_client()


@st.cache_data(ttl=600)
def q(sql: str):
    return client.query(sql).to_dataframe()


st.title("Outreach funnel")
st.caption("Live from BigQuery, built by the compa-warehouse pipeline.")

# --- KPI row -------------------------------------------------------------
kpis = q(
    f"""
    SELECT
        (SELECT count(*) FROM `{PROJECT}.silver.stg_leads`) AS leads,
        (SELECT count(*) FROM `{PROJECT}.gold.fact_touch`)  AS touches,
        (SELECT round(sum(is_open)  * 100.0 / count(*), 1) FROM `{PROJECT}.gold.fact_touch`) AS open_rate,
        (SELECT round(sum(is_reply) * 100.0 / count(*), 1) FROM `{PROJECT}.gold.fact_touch`) AS reply_rate
    """
).iloc[0]

c1, c2, c3, c4 = st.columns(4)
c1.metric("Leads", int(kpis.leads))
c2.metric("Touches", int(kpis.touches))
c3.metric("Open rate", f"{kpis.open_rate}%")
c4.metric("Reply rate", f"{kpis.reply_rate}%")

# --- Funnel by angle -----------------------------------------------------
mart = q(
    f"SELECT * FROM `{PROJECT}.gold.mart_outreach_funnel` ORDER BY total_touches DESC"
)
st.subheader("Reply rate by angle")
st.bar_chart(mart, x="angle", y="reply_rate_pct")
st.subheader("Full funnel")
st.dataframe(mart, use_container_width=True, hide_index=True)

# --- Leads by current status (from the SCD-2 snapshot) -------------------
status = q(
    f"""
    SELECT status, count(*) AS leads
    FROM `{PROJECT}.silver.scd_leads`
    WHERE dbt_valid_to IS NULL
    GROUP BY status
    ORDER BY leads DESC
    """
)
st.subheader("Leads by current status")
st.bar_chart(status, x="status", y="leads")
