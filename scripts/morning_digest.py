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

    The research datasets (Bank of England millennium, JST, Shiller, IMF debt,
    Maddison) are academic files revised once a year at most. Listing them as
    "stale" every morning is noise, and noise is what gets a brief skimmed. They
    get one quiet line.

    The daily/research split is taken from expected_lag_days, NOT from a list of
    source names. The name list was a maintenance trap: it held four hardcoded
    words, so the two long-history sources registered on 2026-09-03 (IMF debt,
    Maddison) would have been reported in the DAILY bucket and shouted about every
    morning. expected_lag_days already encodes each source's publication cadence,
    which is the thing being asked about, and a new source now classifies itself.
    """
    r = rows(c, f"""
        SELECT source, data_age_days, expected_lag_days, status
        FROM `{PROJECT}.gold.mart_data_freshness`
        WHERE status != 'current'
        ORDER BY data_age_days DESC
    """)
    if not r:
        return []
    # A feed expected to move less often than once a year is a research dataset.
    def is_research(x):
        lag = x.get("expected_lag_days")
        return lag is not None and lag >= 365
    daily = [x for x in r if not is_research(x)]
    research = [x for x in r if is_research(x)]
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


# The comparative panels are ANNUAL data and must not be printed daily.
#
# mart_big_cycle_comparative is as-of each country's latest year (2024 for the
# major powers) and mart_world_power ends at 2022. Pasting either into a daily
# brief prints the same three lines every morning for a year, which is the exact
# thing this file's house style says to drop. They live on the dashboard, where
# standing context belongs, and reach the brief only as EVENTS.
#
# Two gates, both event-shaped rather than threshold-shaped, so there is no
# invented number to tune:
#   1. a major power changed stage year over year (stage_changed in the mart,
#      scored through the one int_big_cycle_stages definition)
#   2. the latest year is a new post-1950 extreme in share of world output
#
# Both are additionally gated on the source having loaded recently, which is what
# stops a change from being re-announced for a year. That recency is per PIPELINE,
# not per source: dlt records one load timestamp for the whole long-history
# pipeline, so a Shiller refresh opens the window for these too. It only affects
# WHEN the question is asked; the event gates decide whether anything is said.
#
# last_loaded can be NULL (the pipeline-name mismatch documented in
# mart_data_freshness). NULL is treated as NOT fresh, so an unknown stays silent
# rather than being reported as a change.
# 7 days, chosen 2026-09-03. NOT derived: there have only ever been two
# long-history loads (2026-08-20 and 2026-09-03), which is no distribution to
# derive from, so this is a judgment and is recorded as one. The reasoning is the
# asymmetry of the two failure modes. Too long and the same line becomes wallpaper
# and the section stops being read, which is the specific thing this file's house
# style exists to prevent. Too short and an event is missed -- but the brief runs
# daily, so a week is seven chances to see it. Widen it if an event is ever missed;
# do not delete the window, or a single change gets re-announced for a year.
FRESH_LOAD_DAYS = 7

CYCLE_SOURCES = ("IMF historical public debt", "Maddison Project (world output)")


def _sql_list(names):
    """Quote a fixed tuple of literals for an IN clause. These are constants
    defined in this file, never user input, but relying on Python repr to emit
    valid SQL quoting is the kind of thing that breaks the day a name gains an
    apostrophe, so it is explicit."""
    return ", ".join("'" + n.replace("'", "''") + "'" for n in names)


def _recent_loads(c):
    """Which long-arc sources loaded inside the window. Empty on any doubt."""
    r = rows(c, f"""
        SELECT source, last_loaded,
               DATE_DIFF(CURRENT_DATE(), DATE(last_loaded), DAY) AS days_since_load
        FROM `{PROJECT}.gold.mart_data_freshness`
        WHERE source IN ({_sql_list(CYCLE_SOURCES)})
    """)
    return {
        x["source"]
        for x in r
        if x.get("days_since_load") is not None
        and x["days_since_load"] <= FRESH_LOAD_DAYS
    }


def _long_arc_events(c, fresh):
    """At most two lines, and only when something actually moved."""
    out = []

    if "IMF historical public debt" in fresh:
        moved = rows(c, f"""
            SELECT country, prior_stage_name, stage_name, as_of_year
            FROM `{PROJECT}.gold.mart_big_cycle_comparative`
            WHERE is_major_power AND stage_changed
            ORDER BY debt_to_gdp DESC
        """)
        for m in moved:
            out.append(
                f"  {m['country']} moved from \"{m['prior_stage_name']}\" to "
                f"\"{m['stage_name']}\" in {m['as_of_year']}."
            )

    if "Maddison Project (world output)" in fresh:
        ext = rows(c, f"""
            WITH scoped AS (
                SELECT country, year, pct_of_world_gdp
                FROM `{PROJECT}.gold.mart_world_power`
                WHERE year >= 1950 AND country IN ('United States', 'China')
            ),
            bounds AS (
                SELECT country, MIN(pct_of_world_gdp) AS lo,
                       MAX(pct_of_world_gdp) AS hi, MAX(year) AS latest_year
                FROM scoped GROUP BY country
            )
            SELECT s.country, s.year, s.pct_of_world_gdp,
                   s.pct_of_world_gdp <= b.lo AS is_new_low,
                   s.pct_of_world_gdp >= b.hi AS is_new_high
            FROM scoped s
            JOIN bounds b ON b.country = s.country AND b.latest_year = s.year
        """)
        for e in ext:
            share = e.get("pct_of_world_gdp")
            if share is None:
                continue
            if e.get("is_new_low"):
                out.append(
                    f"  {e['country']} share of world output is at its lowest since "
                    f"1950, {share:.1f}% in {e['year']}."
                )
            elif e.get("is_new_high"):
                out.append(
                    f"  {e['country']} share of world output is at a post-1950 high, "
                    f"{share:.1f}% in {e['year']}."
                )
    return out


def section_market(c):
    reg = rows(c, f"SELECT * FROM `{PROJECT}.gold.mart_macro_regime`")
    cyc = rows(c, f"""
        SELECT stage_name, description, implication, debt_to_gdp
        FROM `{PROJECT}.gold.mart_big_cycle` WHERE is_current
    """)
    events = _long_arc_events(c, _recent_loads(c))
    if not reg and not cyc and not events:
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
    if events:
        out.append("")
        out.extend(events)
    return out


# ------------------------------------------------------------- where you stand
# The only section measured against an OUTSIDE reference. Everything else in this
# brief compares Rafa to targets he set himself, which can say whether he did what
# he said and never whether what he said was any good.
#
# Comparability is spoken out loud, not implied. A Federal Reserve percentile and
# a consulting-rate blog are not the same kind of fact, and rendering them
# identically would launder the weaker one.
def section_standing(c):
    rows_ = rows(c, f"""
        SELECT domain, metric_key, tier, baseline_value, current_value, standing,
               gap_to_tier, change_90d, change_90d_pct, comparability, population
        FROM `{PROJECT}.gold.mart_baseline_vs_actual`
        WHERE current_value IS NOT NULL
        ORDER BY domain, metric_key, baseline_value
    """)
    if not rows_:
        return []

    out = ["WHERE YOU STAND", ""]

    # --- net worth: headline is the percentile, sub-point is the climb ---------
    nw = [r for r in rows_ if r["metric_key"] == "net_worth"]
    if nw:
        cur = float(nw[0]["current_value"])
        above = [r for r in nw if r["standing"] == "at or above"]
        below = [r for r in nw if r["standing"] == "below"]
        tier_word = {"p50": "the median", "p75": "the top quarter",
                     "p90": "the top 10%", "p99": "the top 1%"}
        if above:
            best = max(above, key=lambda r: float(r["baseline_value"]))
            head = (f"  Your net worth is {money(cur)}, "
                    f"above {tier_word.get(best['tier'], best['tier'])} "
                    f"for your age.")
        else:
            nearest = min(below, key=lambda r: float(r["baseline_value"]))
            head = (f"  Your net worth is {money(cur)}, "
                    f"{money(float(nearest['baseline_value']) - cur)} short of "
                    f"{tier_word.get(nearest['tier'], nearest['tier'])} for your age.")
        chg = nw[0].get("change_90d")
        if chg is not None:
            pct = nw[0].get("change_90d_pct")
            direction = "up" if float(chg) >= 0 else "down"
            head += (f" {direction.capitalize()} {money(abs(float(chg)))}"
                     f"{f' ({float(pct):+.0f}%)' if pct is not None else ''} "
                     f"over 90 days.")
        out.append(head)
        # At most two rungs ahead. The 1% line from here is noise, not a goal.
        for r in sorted(below, key=lambda r: float(r["baseline_value"]))[:2]:
            need = float(r["baseline_value"]) - cur
            label = tier_word.get(r["tier"], r["tier"])
            out.append(f"    {label[0].upper()}{label[1:]} needs "
                       f"{money(need)} more.")
        out.append("    Source: Federal Reserve survey data for your age band.")

    # --- retainer: the number is real, the benchmark is not neutral -----------
    ret = [r for r in rows_ if r["metric_key"] == "monthly_retainer"]
    if ret:
        cur = float(ret[0]["current_value"])
        floor = min(float(r["baseline_value"]) for r in ret)
        out.append("")
        out.append(f"  Your one retainer is {money(cur)} a month against a "
                   f"{money(floor)} floor for small-client consulting work.")
        out.append("    That benchmark comes from firms who sell pricing advice "
                   "to consultants, so read it as the optimistic end, not a target.")
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
    "standing": section_standing,
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
