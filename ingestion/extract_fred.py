"""Extract FRED macro series to a JSON landing file (Engine B / macro).

Runs in the warehouse venv (stdlib only). Reads FRED_API_KEY from .env.
Pulls ~2 years of observations for the 5-indicator panel + regime inputs.

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

SERIES = {
    "oil_wti": "DCOILWTICO",  # energy
    "cpi": "CPIAUCSL",  # inflation (level -> YoY downstream)
    "commodities": "PPIACO",  # metals / commodities (PPI all commodities)
    "fed_funds": "DFF",  # central-bank policy
    "bond_10y": "DGS10",  # 10-year Treasury yield
    "yield_curve_10y2y": "T10Y2Y",  # policy / recession signal
    "industrial_production": "INDPRO",  # growth (regime)
}


def main() -> None:
    start = (date.today() - timedelta(days=800)).isoformat()
    rows = []
    for name, sid in SERIES.items():
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
