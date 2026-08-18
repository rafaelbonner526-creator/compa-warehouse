"""compa-warehouse serving dashboard (BigQuery).

Two tabs: Outreach (SIGNAL funnel) and Budget (Monarch finance, Rocket-Money style).
Credentials from st.secrets (cloud) or the key file (local).

Run local:  set -a; source .env; set +a; uv run streamlit run dashboard/app.py
"""

import calendar
import datetime as dt
import os

import pandas as pd
import streamlit as st
from google.cloud import bigquery
from google.oauth2 import service_account

PROJECT = "compa-warehouse"

st.set_page_config(page_title="COMPA Warehouse", layout="wide")


@st.cache_resource
def get_client() -> bigquery.Client:
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


def money(x) -> str:
    return f"${x:,.0f}"


outreach_tab, budget_tab = st.tabs(["Outreach", "Budget"])

# ============================ OUTREACH ==================================
with outreach_tab:
    st.title("Outreach funnel")
    st.caption("Live from BigQuery, built by the compa-warehouse pipeline.")
    k = q(
        f"""
        SELECT
            (SELECT count(*) FROM `{PROJECT}.silver.stg_leads`) AS leads,
            (SELECT count(*) FROM `{PROJECT}.gold.fact_touch`)  AS touches,
            (SELECT round(sum(is_open)  * 100.0 / count(*), 1) FROM `{PROJECT}.gold.fact_touch`) AS open_rate,
            (SELECT round(sum(is_reply) * 100.0 / count(*), 1) FROM `{PROJECT}.gold.fact_touch`) AS reply_rate
        """
    ).iloc[0]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Leads", int(k.leads))
    c2.metric("Touches", int(k.touches))
    c3.metric("Open rate", f"{k.open_rate}%")
    c4.metric("Reply rate", f"{k.reply_rate}%")
    mart = q(
        f"SELECT * FROM `{PROJECT}.gold.mart_outreach_funnel` ORDER BY total_touches DESC"
    )
    st.subheader("Reply rate by angle")
    st.bar_chart(mart, x="angle", y="reply_rate_pct")
    st.dataframe(mart, use_container_width=True, hide_index=True)

# ============================ BUDGET ====================================
with budget_tab:
    st.title("Budget")

    sts = q(f"SELECT * FROM `{PROJECT}.gold.mart_safe_to_spend`").iloc[0]
    nw_now = q(
        f"SELECT net_worth FROM `{PROJECT}.gold.mart_networth` ORDER BY snapshot_date DESC LIMIT 1"
    ).iloc[0]["net_worth"]

    today = dt.date.today()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_left = days_in_month - today.day + 1
    left = float(sts.safe_to_spend_month)
    daily = left / days_left if days_left else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Left to spend", money(left), help="Living budget minus spent this month")
    c2.metric(
        "Daily allowance", money(daily), help=f"{days_left} days left in the month"
    )
    c3.metric("Spent this month", money(sts.spent_this_month))
    c4.metric("Net worth", money(nw_now))

    # month budget progress
    spent = float(sts.spent_this_month)
    budget = float(sts.living_target)
    st.caption(f"Spent {money(spent)} of {money(budget)} Living budget this month")
    st.progress(min(spent / budget, 1.0) if budget else 0.0)

    left_col, right_col = st.columns(2)
    with left_col:
        st.subheader("Net worth")
        nw = q(
            f"SELECT snapshot_date, net_worth FROM `{PROJECT}.gold.mart_networth` ORDER BY snapshot_date"
        )
        st.line_chart(nw, x="snapshot_date", y="net_worth")
    with right_col:
        st.subheader("Cash flow (net by month)")
        cf = q(
            f"SELECT month, net FROM `{PROJECT}.gold.mart_monthly_cashflow` ORDER BY month DESC LIMIT 8"
        )
        cf["month"] = pd.to_datetime(cf["month"]).dt.strftime("%Y-%m")
        st.bar_chart(cf.sort_values("month"), x="month", y="net")

    left2, right2 = st.columns(2)
    with left2:
        st.subheader("Spending by category (this month)")
        cat = q(
            f"""
            SELECT category_group, spend
            FROM `{PROJECT}.gold.mart_spend_by_category`
            WHERE month = (SELECT max(month) FROM `{PROJECT}.gold.mart_spend_by_category`)
            ORDER BY spend DESC LIMIT 8
            """
        )
        st.bar_chart(cat, x="category_group", y="spend", horizontal=True)
    with right2:
        st.subheader("Upcoming bills")
        bills = q(
            f"""
            SELECT due_date, merchant, round(abs(amount)) AS amount
            FROM `{PROJECT}.silver.stg_recurring`
            WHERE due_date >= current_date()
            ORDER BY due_date LIMIT 8
            """
        )
        st.dataframe(bills, use_container_width=True, hide_index=True)

    st.subheader("Recent transactions")
    recent = q(
        f"""
        SELECT txn_date, merchant, category, round(amount) AS amount
        FROM `{PROJECT}.silver.stg_transactions`
        WHERE NOT hide_from_reports
        ORDER BY txn_date DESC LIMIT 12
        """
    )
    st.dataframe(recent, use_container_width=True, hide_index=True)

    st.caption("Grounded in the ALTO 70% Living bucket. Not financial advice.")
