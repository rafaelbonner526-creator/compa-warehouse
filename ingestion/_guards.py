"""Refuse to destroy good data with an empty load.

WHY THIS EXISTS
---------------
Every bronze loader here runs dlt with write_disposition="replace". That is the
right disposition, because each source is a full snapshot of current state rather
than an append log. It also means an empty frame does not load nothing, it DELETES
what was there.

The failure chain is short and entirely silent:

    Monarch auth expires  ->  extract writes transactions.json with 0 records
                          ->  load replaces bronze.mm_transactions with nothing
                          ->  budget, safe-to-spend, runway and net worth all
                              compute zeros against an empty table
                          ->  the morning brief prints "$0 spent this month"
                              in plain English, with total confidence

Nothing errors anywhere along that path. extract_monarch.dump() prints the record
count and writes regardless; the loaders never look at row counts at all.

This is the "empty is not the same as unknown" rule applied to ingestion. Zero rows
from a source that had 1,783 yesterday is not a fact about your spending, it is a
broken extract.

FLOORS ARE MEASURED, NOT GUESSED
--------------------------------
Taken from live bronze row counts on 2026-09-02, then set well below them so normal
variation never trips the guard:

    mm_transactions  1783 rows  -> floor  100
    mm_networth       155       -> floor   20
    mm_categories      63       -> floor   10
    mm_holdings        19       -> floor    1
    mm_accounts        12       -> floor    3
    mm_recurring       12       -> floor    1
    leads_master      214       -> floor   20
    touch_log         171       -> floor   20
    fred_observations 43473     -> floor 1000
    lh_*              2.8k-55k  -> floor  500

A floor is a claim that a real snapshot can never be smaller than this. Set it low
enough that it only fires on breakage, because a guard that trips on a quiet week
gets removed and then protects nothing.
"""


import os


class EmptyLoadRefused(RuntimeError):
    """Raised instead of replacing a populated table with an empty one."""


# table name -> minimum plausible row count for a healthy full snapshot
FLOORS = {
    "mm_transactions": 100,
    "mm_networth": 20,
    "mm_categories": 10,
    "mm_holdings": 1,
    "mm_accounts": 3,
    "mm_recurring": 1,
    "leads_master": 20,
    "touch_log": 20,
    "fred_observations": 1000,
    "lh_shiller": 500,
    "lh_jst": 500,
    "lh_boe": 500,
    "lh_maddison": 500,
    "lh_imf_debt": 500,
    # Stripe holds 1 row per table today (one subscription). A floor of 1 still
    # catches a total wipe without firing on a genuinely tiny customer base.
    "stripe_charges": 1,
    "stripe_customers": 1,
    "stripe_invoices": 1,
    "stripe_subscriptions": 1,
}


def _floors_apply() -> bool:
    """Floors protect the PRODUCTION warehouse only.

    CI builds a throwaway DuckDB from tests/fixtures on every run, and those
    fixtures are deliberately tiny: the leads fixture holds 10 rows against a
    production floor of 20. There is nothing to protect there, and applying
    production-derived thresholds to fixture data broke CI on 2026-09-02 for two
    commits before anyone looked.

    That is the same mistake in a different place: a threshold measured in one
    environment and enforced in another.
    """
    return os.getenv("WAREHOUSE_TARGET", "duckdb") == "bigquery"


def check_rows(table: str, n_rows: int, floor: int | None = None) -> None:
    """Raise if a replace-load would shrink a table below its plausible floor.

    Deliberately raises rather than warning. A warning in a launchd job goes to a
    log file nobody reads, and the destructive write still happens. Failing loudly
    leaves yesterday's good data in place, which is the correct outcome: stale and
    correct beats fresh and empty.
    """
    if not _floors_apply():
        return
    limit = FLOORS.get(table) if floor is None else floor
    if limit is None:
        return
    if n_rows < limit:
        raise EmptyLoadRefused(
            f"{table}: refusing to replace with {n_rows} rows, floor is {limit}. "
            f"The source almost certainly failed rather than genuinely emptying. "
            f"Existing data is untouched. Check the extract step and its credentials, "
            f"then re-run. Override with a floor= argument only if the shrink is real."
        )
