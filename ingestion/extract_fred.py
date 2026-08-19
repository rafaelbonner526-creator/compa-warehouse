"""Extract FRED macro series to a JSON landing file (Engine B / macro).

Runs in the warehouse venv (stdlib only). Reads FRED_API_KEY from .env.
Pulls ~2 years of observations for the indicator panel + regime inputs, and
~20 years for the slow structural series (capacity utilization, debt/GDP) so
their long-run averages and cycle position are meaningful.

Run:  set -a; source .env; set +a; uv run ingestion/extract_fred.py
"""

import json
import os
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
KEY = os.environ["FRED_API_KEY"]
OUT = Path(__file__).parent.parent / "data" / "raw" / "fred"
OUT.mkdir(parents=True, exist_ok=True)

CYCLE_DAYS = 800  # ~2 years, enough for YoY + 90-day change
STRUCTURAL_DAYS = 7500  # ~20 years, for long-run averages and the Big Cycle

# name -> (FRED series id, days of history)
SERIES = {
    "oil_wti": ("DCOILWTICO", CYCLE_DAYS),  # energy
    "cpi": ("CPIAUCSL", CYCLE_DAYS),  # inflation (level -> YoY downstream)
    "commodities": ("PPIACO", CYCLE_DAYS),  # metals / commodities (PPI all commodities)
    "fed_funds": ("DFF", CYCLE_DAYS),  # central-bank policy / cash yield
    "bond_10y": ("DGS10", CYCLE_DAYS),  # 10-year Treasury yield
    "yield_curve_10y2y": ("T10Y2Y", CYCLE_DAYS),  # policy / recession signal
    "industrial_production": ("INDPRO", CYCLE_DAYS),  # growth (regime)
    "corp_baa": ("BAA", CYCLE_DAYS),  # Baa corporate yield, credit rung of the risk stack
    # Dalio equilibrium inputs: long history on purpose.
    "capacity_utilization": ("TCU", STRUCTURAL_DAYS),  # slack vs overheating
    "debt_to_gdp": ("GFDEGDQ188S", STRUCTURAL_DAYS),  # long-term debt cycle
    # 18-year property cycle (Harrison/Anderson). Needs enough history to locate
    # the last trough from the data rather than asserting a date.
    "house_prices": ("CSUSHPINSA", STRUCTURAL_DAYS),  # Case-Shiller US national
}


def main() -> None:
    rows = []
    for name, (sid, days) in SERIES.items():
        start = (date.today() - timedelta(days=days)).isoformat()
        url = (
            "https://api.stlouisfed.org/fred/series/observations?"
            + urllib.parse.urlencode(
                {
                    "series_id": sid,
                    "api_key": KEY,
                    "file_type": "json",
                    "observation_start": start,
                }
            )
        )
        try:
            data = json.loads(urllib.request.urlopen(url, timeout=30).read())
        except Exception as ex:  # noqa: BLE001
            print(f"  {name} ({sid}): SKIPPED ({ex})")
            continue
        obs = [
            {"series": name, "series_id": sid, "date": o["date"], "value": o["value"]}
            for o in data.get("observations", [])
            if o["value"] not in (".", "")
        ]
        rows.extend(obs)
        print(f"  {name} ({sid}): {len(obs)} obs")
    (OUT / "observations.json").write_text(json.dumps(rows))
    print(f"total {len(rows)} observations -> observations.json")


if __name__ == "__main__":
    main()
