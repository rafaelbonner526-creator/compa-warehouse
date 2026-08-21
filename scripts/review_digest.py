#!/usr/bin/env python3
"""Render the review digest as plain text.

Prints what the /review page shows, in a form that pipes into anything: email via
Resend, a Telegram message, the morning brief, or just a terminal.

Delivery deliberately is NOT built in here. The whole point of the digest is to
arrive on the cadence the framework prescribes, and the cadences already exist as
launchd jobs. Hard-wiring a transport would mean choosing one; printing to stdout
means the existing cron decides.

Usage:
    uv run scripts/review_digest.py              # dev warehouse
    WAREHOUSE_TARGET=bigquery uv run scripts/review_digest.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

SEVERITY_LABEL = {1: "ACT NOW", 2: "AT THE REVIEW", 3: "CONTEXT"}


def rows() -> list[tuple]:
    target = os.getenv("WAREHOUSE_TARGET", "duckdb")
    q = """
        SELECT severity, section, headline, detail, value
        FROM {schema}mart_review_digest
        ORDER BY severity, ord, headline
    """
    if target == "bigquery":
        from google.cloud import bigquery

        client = bigquery.Client(project=os.environ["GCP_PROJECT"])
        return [
            (r.severity, r.section, r.headline, r.detail, r.value)
            for r in client.query(q.format(schema="gold.")).result()
        ]

    import duckdb

    path = os.getenv(
        "WAREHOUSE_DUCKDB_PATH",
        str(Path(__file__).parent.parent / "data" / "warehouse.duckdb"),
    )
    con = duckdb.connect(path, read_only=True)
    return con.sql(q.format(schema="gold.")).fetchall()


def main() -> None:
    data = rows()
    if not data:
        print("Review digest: nothing to report.")
        return

    width = 74
    print("=" * width)
    print("REVIEW DIGEST")
    print("=" * width)

    last_sev = None
    for severity, section, headline, detail, value in data:
        if severity != last_sev:
            print(f"\n--- {SEVERITY_LABEL.get(severity, severity)} " + "-" * (width - 6 - len(SEVERITY_LABEL.get(severity, ''))))
            last_sev = severity
        print(f"\n[{section}] {headline}")
        if value:
            print(f"    {value}")
        if detail:
            # wrap detail at the print width without pulling in textwrap config
            words, line = detail.split(), "   "
            for w in words:
                if len(line) + len(w) + 1 > width:
                    print(line)
                    line = "   "
                line += " " + w
            if line.strip():
                print(line)

    acts = sum(1 for r in data if r[0] == 1)
    print("\n" + "=" * width)
    print(f"{acts} item(s) need action now. {len(data)} total.")
    print("=" * width)


if __name__ == "__main__":
    sys.exit(main())
