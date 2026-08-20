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
# Everything the marts express as a percentile of its own history gets FULL history.
# A percentile is a claim about where a value sits in its own distribution, so
# silently truncating the distribution to 20 years makes the claim wrong. FRED
# returns from series inception when the start predates it.
FULL_HISTORY = 60000  # ~164 years, i.e. "give me everything you have"

# name -> (FRED series id, days of history)
SERIES = {
    "oil_wti": ("DCOILWTICO", CYCLE_DAYS),  # energy
    "cpi": ("CPIAUCSL", FULL_HISTORY),  # inflation. FULL history because the property
    # cycle deflates nominal house prices by it; 2 years of CPI cannot deflate 39 years of prices.
    "commodities": ("PPIACO", CYCLE_DAYS),  # metals / commodities (PPI all commodities)
    "fed_funds": ("DFF", CYCLE_DAYS),  # central-bank policy / cash yield
    "bond_10y": ("DGS10", CYCLE_DAYS),  # 10-year Treasury yield
    "yield_curve_10y2y": ("T10Y2Y", CYCLE_DAYS),  # policy / recession signal
    "industrial_production": ("INDPRO", CYCLE_DAYS),  # growth (regime)
    "corp_baa": ("BAA", CYCLE_DAYS),  # Baa corporate yield, credit rung of the risk stack
    # Dalio equilibrium inputs: long history on purpose.
    "capacity_utilization": ("TCU", FULL_HISTORY),  # slack vs overheating
    "debt_to_gdp": ("GFDEGDQ188S", FULL_HISTORY),  # long-term debt cycle
    # 18-year property cycle (Harrison/Anderson). Needs enough history to locate
    # the last trough from the data rather than asserting a date.
    "house_prices": ("CSUSHPINSA", FULL_HISTORY),  # Case-Shiller US national
    # Big Cycle stage signals. Debt/GDP alone cannot separate "top of cycle" from
    # "decline"; Dalio's decline signature is negative real rates + foreign selling
    # + a falling dollar, so all three are measured rather than assumed.
    "dollar_index": ("DTWEXBGS", FULL_HISTORY),  # broad trade-weighted USD
    "real_rate_10y": ("DFII10", FULL_HISTORY),  # 10y TIPS yield = real rate
    "foreign_treasury": ("FDHBFIN", FULL_HISTORY),  # foreign-held Treasuries
    # News-derived climate. These are built by counting newspaper coverage
    # (Baker/Bloom/Davis) or by pricing risk, so they quantify "what the world
    # feels like" without us scraping headlines. Long windows on purpose: the
    # marts express each as a percentile of its own ~20-year history, because a
    # raw VIX of 15 means nothing without knowing where 15 sits.
    "policy_uncertainty": ("USEPUINDXD", FULL_HISTORY),  # US EPU, daily, news-count based
    "global_policy_uncertainty": ("GEPUCURRENT", FULL_HISTORY),  # global EPU, monthly
    "financial_stress": ("STLFSI4", FULL_HISTORY),  # St. Louis Fed stress index
    "vix": ("VIXCLS", FULL_HISTORY),  # equity volatility, the market's own fear read
    "recession_prob": ("RECPROUSM156N", FULL_HISTORY),  # smoothed recession probability
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
