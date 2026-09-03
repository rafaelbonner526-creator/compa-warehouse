#!/usr/bin/env python3
"""The morning brief, in plain English.

WHY THIS EXISTS
---------------
Thirty-seven marts were being built every morning and none of them reached Rafa.
The COMPA morning-brief skill read PLM's CLAUDE.md, called the calendar, and
queried the vault. It never touched the warehouse, so budget, portfolio, market,
outreach and the review digest all sat unread in BigQuery.

HOUSE STYLE, ENFORCED HERE ON PURPOSE
-------------------------------------
This is Compa talking to Rafa, not a system emitting records. That means:

  - No internal identifiers. No draft ids, no mart names, no migration numbers,
    no "REQ-1", no "[vault]". If he cannot act on it, it does not appear.
  - No column names leaking into prose. "aw_box" and "quadrant" become sentences.
  - Numbers get their meaning attached. "$1,240 left" not "flexible_left=1240".
  - Say what needs him FIRST. Everything else is context.
  - When data is stale, say so in words. Never print a confident number from a
    feed that stopped updating a week ago.

If a section has nothing to say, it says nothing. A brief that pads is a brief
that gets skimmed.

Usage:
    uv run scripts/morning_digest.py
    uv run scripts/morning_digest.py --section money
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

PROJECT = os.environ.get("GCP_PROJECT", "compa-warehouse")


def get_client():
    from google.cloud import bigquery
    from google.oauth2 import service_account

    creds = service_account.Credentials.from_service_account_file(
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    )
    return bigquery.Client(credentials=creds, project=PROJECT)


def rows(client, sql):
    """Run a query, return list of dicts. Never raise: a missing mart must not
    take down the whole brief, it should just make one section go quiet."""
    try:
        return [dict(r) for r in client.query(sql).result()]
    except Exception as e:  # noqa: BLE001
        print(f"  (could not read this section: {type(e).__name__})", file=sys.stderr)
        return []


def money(x):
    if x is None:
        return "unknown"
    return f"${x:,.0f}"


def plain_pct(x):
    if x is None:
        return "unknown"
    return f"{x:.0f}%"


# ---------------------------------------------------------------- freshness
def section_freshness(c):
    """Only shout about feeds that are SUPPOSED to move daily.

    The research datasets (Bank of England millennium, JST, Shiller) are academic
    files revised once a year at most. Listing them as "stale" every morning is
    noise, and noise is what gets a brief skimmed. They get one quiet line.
    """
    r = rows(c, f"""
        SELECT source, data_age_days, expected_lag_days, status
        FROM `{PROJECT}.gold.mart_data_freshness`
        WHERE status != 'current'
        ORDER BY data_age_days DESC
    """)
    if not r:
        return []
    research_words = ("millennium", "jst", "shiller", "macrohistory")
    daily = [x for x in r if not any(w in (x["source"] or "").lower() for w in research_words)]
    research = [x for x in r if any(w in (x["source"] or "").lower() for w in research_words)]
    out = []
    if daily:
        out.append("HEADS UP, SOME NUMBERS BELOW ARE OLD")
        out.append("")
        for x in daily:
            age = x.get("data_age_days")
            out.append(f"  {x['source']} last updated {int(age)} days ago.")
        out.append("  Anything drawn from those is indicative, not current.")
    if research:
        names = ", ".join(x["source"] for x in research)
        line = f"  The long-history research files ({names}) are behind their usual refresh."
        if out:
            out.append(line)
        else:
            out = ["HEADS UP", "", line]
    return out


# ---------------------------------------------------------------- needs you
def section_needs_you(c):
    acts = rows(c, f"""
        SELECT severity, area, title, detail, current_value, target_value, unit
        FROM `{PROJECT}.gold.mart_portfolio_actions`
        WHERE severity = 1
        ORDER BY area
    """)
    rev = rows(c, f"""
        SELECT headline, detail
        FROM `{PROJECT}.gold.mart_review_digest`
        WHERE severity = 1
        ORDER BY ord
    """)
    if not acts and not rev:
        return []
    out = ["WHAT NEEDS YOU TODAY", ""]
    # The same item can appear in both the portfolio actions and the review
    # digest. Saying it twice makes the brief look broken, so dedupe on the
    # headline text rather than on which mart it came from.
    seen = set()
    for title, detail in [(a["title"], a.get("detail")) for a in acts] + \
                         [(r["headline"], r.get("detail")) for r in rev]:
        key = (title or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(f"  {title}" + (f". {detail}" if detail else ""))
    return out


# ---------------------------------------------------------------- money
def section_money(c):
    s = rows(c, f"SELECT * FROM `{PROJECT}.gold.mart_safe_to_spend`")
    rw = rows(c, f"SELECT * FROM `{PROJECT}.gold.mart_runway`")
    over = rows(c, f"""
        SELECT category_group, spend_mtd, monthly_target, projected_month
        FROM `{PROJECT}.gold.mart_budget_vs_actual`
        WHERE spend_mtd > 0
          AND projected_month > monthly_target
          -- Deliberately NOT filtering on the status column. Early in the month it
          -- marks categories 'over' at zero spend, and 'Travel' at $5 spent
          -- projecting $79 against a $250 target. Projected-over-target is the
          -- question actually being asked, so ask it directly.
        ORDER BY (projected_month - monthly_target) DESC
        LIMIT 4
    """)
    if not s and not rw:
        return []
    out = ["MONEY", ""]
    if s:
        d = s[0]
        left = d.get("flexible_left")
        if left is not None:
            if left < 0:
                out.append(f"  You are {money(abs(left))} over your flexible budget this month.")
            else:
                out.append(f"  {money(left)} left in flexible spending this month.")
        act, tgt = d.get("actual_savings_rate_pct"), d.get("target_savings_rate_pct")
        if act is not None:
            # A negative or absent target is a bug upstream, not a goal. Compare
            # against it and the brief prints something meaningless like "ahead of
            # your -32% target". Say the real number and stay quiet about the rest.
            if tgt is not None and tgt > 0:
                verb = "ahead of" if act >= tgt else "behind"
                out.append(f"  Saving {plain_pct(act)} of what comes in, {verb} your {plain_pct(tgt)} target.")
            else:
                out.append(f"  Saving {plain_pct(act)} of what comes in.")
    if rw:
        m = rw[0].get("runway_months")
        if m is not None:
            out.append(f"  If income stopped today, savings cover about {m:.0f} months.")
    if over:
        out.append("")
        out.append("  Running hot:")
        for o in over:
            out.append(
                f"    {o['category_group']}: {money(o['spend_mtd'])} spent against "
                f"{money(o['monthly_target'])}, on track for {money(o['projected_month'])}."
            )
    return out


# ---------------------------------------------------------------- portfolio
def section_portfolio(c):
    nw = rows(c, f"""
        SELECT net_worth FROM `{PROJECT}.gold.mart_networth`
        ORDER BY snapshot_date DESC LIMIT 1
    """)
    over = rows(c, f"""
        SELECT ticker, name, pct_of_active, cap_pct
        FROM `{PROJECT}.gold.mart_positions`
        WHERE over_cap ORDER BY pct_of_active DESC
    """)
    acts = rows(c, f"""
        SELECT title, detail FROM `{PROJECT}.gold.mart_portfolio_actions`
        WHERE severity = 2 ORDER BY area LIMIT 4
    """)
    if not nw and not over and not acts:
        return []
    out = ["PORTFOLIO", ""]
    if nw:
        out.append(f"  Net worth {money(nw[0]['net_worth'])}.")
    for o in over:
        out.append(
            f"  {o['name'] or o['ticker']} is {plain_pct(o['pct_of_active'])} of the active "
            f"sleeve, above the {plain_pct(o['cap_pct'])} ceiling you set."
        )
    if acts:
        out.append("")
        out.append("  For your next review, not today:")
        for a in acts:
            out.append(f"    {a['title']}" + (f". {a['detail']}" if a.get("detail") else ""))
    return out


# ---------------------------------------------------------------- market
QUADRANT_PLAIN = {
    "rising growth / rising inflation": "growth and inflation are both picking up",
    "rising growth / falling inflation": "growth is picking up while inflation cools",
    "falling growth / rising inflation": "growth is slowing while inflation runs hot",
    "falling growth / falling inflation": "growth and inflation are both cooling",
}


def section_market(c):
    reg = rows(c, f"SELECT * FROM `{PROJECT}.gold.mart_macro_regime`")
    cyc = rows(c, f"""
        SELECT stage_name, description, implication, debt_to_gdp
        FROM `{PROJECT}.gold.mart_big_cycle` WHERE is_current
    """)
    if not reg and not cyc:
        return []
    out = ["THE BACKDROP", ""]
    if reg:
        d = reg[0]
        q = (d.get("quadrant") or "").lower()
        plain = QUADRANT_PLAIN.get(q)
        if plain:
            out.append(f"  Right now {plain}.")
        elif q:
            out.append(f"  Growth is {d.get('growth_direction')}, inflation is {d.get('inflation_direction')}.")
    if cyc:
        d = cyc[0]
        out.append(f"  On the long arc, the US sits at \"{d['stage_name']}\": {d['description'].lower()}.")
        if d.get("implication"):
            out.append(f"  What that argues for: {d['implication'].lower()}.")
    return out


# ---------------------------------------------------------------- outreach
# Internal angle labels mean nothing to a reader. Say what the angle argues.
ANGLE_PLAIN = {
    "A": "the one about warm leads who never book",
    "B": "the one about the trust gap before a first consult",
    "C": "the one about an audience that has not converted",
    "D": "the second-brain angle",
}


def section_outreach(c):
    f = rows(c, f"""
        SELECT angle, total_touches, opens, replies, open_rate_pct, reply_rate_pct
        FROM `{PROJECT}.gold.mart_outreach_funnel` ORDER BY total_touches DESC
    """)
    if not f:
        return []
    t = sum(x["total_touches"] or 0 for x in f)
    o = sum(x["opens"] or 0 for x in f)
    r = sum(x["replies"] or 0 for x in f)
    out = ["OUTREACH", ""]
    out.append(f"  {t} emails sent all time, {o} opened, {r} replied.")
    named = [x for x in f
             if x.get("reply_rate_pct") and (x.get("angle") or "").lower()
             not in ("", "unassigned", "none", "null")]
    best = max(named, key=lambda x: x["reply_rate_pct"], default=None)
    if best:
        label = ANGLE_PLAIN.get((best["angle"] or "").strip().upper())
        who = label or f"the {best['angle']} angle"
        out.append(f"  Your strongest pitch so far is {who}, replying at {best['reply_rate_pct']:.0f}%.")
    elif r == 0:
        out.append("  Nothing has replied yet, so there is no winning angle to lean on.")
    else:
        out.append("  The replies so far came from sends with no angle recorded, so there is nothing to learn from yet.")
    return out


SECTIONS = {
    "freshness": section_freshness,
    "needs_you": section_needs_you,
    "money": section_money,
    "portfolio": section_portfolio,
    "market": section_market,
    "outreach": section_outreach,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--section", choices=list(SECTIONS), help="print one section only")
    a = ap.parse_args()
    c = get_client()
    names = [a.section] if a.section else list(SECTIONS)
    blocks = []
    for n in names:
        b = SECTIONS[n](c)
        if b:
            blocks.append("\n".join(b))
    if not blocks:
        print("Nothing to report from the warehouse this morning.")
        return
    print("\n\n".join(blocks))


if __name__ == "__main__":
    main()
