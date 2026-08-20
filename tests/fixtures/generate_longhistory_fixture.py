"""Generate synthetic CI fixtures for the long-history bronze tables.

The real sources are 1.4MB-27MB Excel workbooks fetched from Yale, macrohistory.net
and the Bank of England. CI must not download them, so this emits small synthetic
files with the same shape (entity, year, period, series, value).

Shapes matter more than values here. The fixtures deliberately include:
  - enough countries and years for mart_property_cycle_intervals to find multiple
    troughs and therefore produce a real interval distribution, since a fixture
    that yields zero intervals would let the mart build green while proving nothing
  - a genuine oscillation in house prices rather than a ramp, for the same reason

Deterministic: no randomness, so CI runs are reproducible.

Run:  uv run tests/fixtures/generate_longhistory_fixture.py
"""

import json
import math
from pathlib import Path

OUT = Path(__file__).parent / "longhistory"
OUT.mkdir(parents=True, exist_ok=True)

COUNTRIES = ["USA", "UK", "France", "Japan"]
Y0, Y1 = 1870, 2020
CYCLE = 18  # synthetic oscillation period, so troughs are findable by construction


def jst() -> list[dict]:
    rows = []
    for ci, c in enumerate(COUNTRIES):
        phase = ci * 3  # stagger countries so intervals are not all identical
        for i, year in enumerate(range(Y0, Y1 + 1)):
            cpi = 5.0 * (1.02**i)
            # trend plus a cycle: real prices oscillate, nominal still rises
            rhp = 100.0 + 3.0 * i + 18.0 * math.sin(2 * math.pi * (i + phase) / CYCLE)
            rows += [
                {"entity": c, "year": year, "period": 0, "series": "cpi", "value": round(cpi, 4)},
                {"entity": c, "year": year, "period": 0, "series": "house_prices_nominal",
                 "value": round(rhp * cpi / 100.0, 4)},
                {"entity": c, "year": year, "period": 0, "series": "nominal_gdp",
                 "value": round(50.0 * (1.03**i), 3)},
                {"entity": c, "year": year, "period": 0, "series": "total_loans",
                 "value": round(20.0 * (1.035**i), 3)},
                {"entity": c, "year": year, "period": 0, "series": "public_debt_to_gdp",
                 "value": round(0.4 + 0.004 * i, 4)},
            ]
    return rows


def shiller() -> list[dict]:
    rows = []
    i = 0
    for year in range(1871, 2025):
        for month in range(1, 13):
            rows += [
                {"entity": "USA", "year": year, "period": month, "series": "cape",
                 "value": round(16.0 + 9.0 * math.sin(2 * math.pi * i / 240), 3)},
                {"entity": "USA", "year": year, "period": month, "series": "price",
                 "value": round(4.0 * (1.0004**i), 4)},
                {"entity": "USA", "year": year, "period": month, "series": "cpi",
                 "value": round(12.0 * (1.0015**i), 4)},
            ]
            i += 1
    return rows


def boe() -> list[dict]:
    rows = []
    for i, year in enumerate(range(1700, 2017)):
        rows += [
            {"entity": "GBR", "year": year, "period": 0, "series": "cpi",
             "value": round(1.0 * (1.012**i), 4)},
            {"entity": "GBR", "year": year, "period": 0, "series": "public_debt",
             "value": round(100.0 * (1.03**i), 3)},
            {"entity": "GBR", "year": year, "period": 0, "series": "nominal_gdp",
             "value": round(200.0 * (1.031**i), 3)},
            {"entity": "GBR", "year": year, "period": 0, "series": "bank_rate",
             "value": round(4.0 + 2.0 * math.sin(2 * math.pi * i / 60), 3)},
        ]
    return rows


def main() -> None:
    for name, fn in (("jst", jst), ("shiller", shiller), ("boe", boe)):
        rows = fn()
        (OUT / f"{name}.json").write_text(json.dumps(rows))
        print(f"wrote {name}.json: {len(rows)} rows")


if __name__ == "__main__":
    main()
