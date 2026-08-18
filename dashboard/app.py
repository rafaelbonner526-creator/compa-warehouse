"""compa-warehouse serving dashboard (BigQuery).

Two tabs: Outreach (SIGNAL funnel) and Budget (Monarch finance). Reads the gold
marts from BigQuery. Credentials from st.secrets (cloud) or the key file (local).

Run local:  set -a; source .env; set +a; uv run streamlit run dashboard/app.py
"""

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
    st.caption(
        "Grounded in the 70% Living bucket, rolling windows. Not financial advice."
    )

    sts = q(f"SELECT * FROM `{PROJECT}.gold.mart_safe_to_spend`").iloc[0]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Safe to spend / week", money(sts.safe_to_spend_week))
    c2.metric("Safe to spend / month", money(sts.safe_to_spend_month))
    c3.metric("Avg income / mo", money(sts.avg_monthly_income))
    c4.metric("Avg spend / mo", money(sts.avg_monthly_spend))

    if sts.safe_to_spend_month < 0:
        st.warning(
            f"You are {money(abs(sts.safe_to_spend_month))} over your Living target "
            f"({money(sts.living_target)}/mo) on the rolling 30-day window."
        )

    cf = q(
        f"SELECT month, income, spend, net FROM `{PROJECT}.gold.mart_monthly_cashflow` ORDER BY month"
    )
    cf["month"] = pd.to_datetime(cf["month"])

    # forecast next 3 months at the trailing-average pace
    last = cf["month"].max()
    fut = pd.DataFrame(
        {
            "month": [last + pd.DateOffset(months=i) for i in range(1, 4)],
            "income": float(sts.avg_monthly_income),
            "spend": float(sts.avg_monthly_spend),
        }
    )
    fut["net"] = fut["income"] - fut["spend"]

    st.subheader("Cash flow (history + 3-month forecast)")
    combined = pd.concat([cf.assign(kind="actual"), fut.assign(kind="forecast")])
    st.line_chart(combined, x="month", y="net", color="kind")
    proj = float(fut["net"].sum())
    st.caption(
        f"Projected next-3-month net at current pace: {money(proj)} "
        f"({money(fut['net'].iloc[0])}/mo)."
    )

    left, right = st.columns(2)
    with left:
        st.subheader("Spend by category (latest month)")
        cat = q(
            f"""
            SELECT category_group, spend
            FROM `{PROJECT}.gold.mart_spend_by_category`
            WHERE month = (SELECT max(month) FROM `{PROJECT}.gold.mart_spend_by_category`)
            ORDER BY spend DESC
            """
        )
        st.bar_chart(cat, x="category_group", y="spend")
    with right:
        st.subheader("Accounts")
        acc = q(
            f"SELECT account, account_type, current_balance FROM `{PROJECT}.gold.mart_account_balances`"
        )
        net_worth = q(
            f"SELECT sum(current_balance) AS nw FROM `{PROJECT}.gold.mart_account_balances` WHERE include_in_net_worth"
        ).iloc[0]["nw"]
        st.metric("Net worth", money(net_worth))
        st.dataframe(acc, use_container_width=True, hide_index=True)
