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


# Added 2026-09-02 alongside the Maddison and IMF sources. Without these, CI failed
# with "Table with name lh_maddison does not exist" on every push: the staging
# models existed but nothing built their bronze tables in the fixture environment.
IMF_CODES = ["USA", "GBR", "CHN", "RUS", "JPN", "NLD"]


def imf_debt() -> list[dict]:
    """Debt-to-GDP as PERCENTAGES, matching the real IMF indicator.

    The fixture must carry the same units as production or it would hide the exact
    bug that shipped on 2026-09-02, when a ratio was read as a percentage and put
    every country in the most flattering cycle stage. Japan is deliberately given a
    high level so the panel-level units guard has something to pass against.
    """
    rows = []
    for i, code in enumerate(IMF_CODES):
        base = [120.0, 100.0, 85.0, 20.0, 235.0, 45.0][i]
        for j, year in enumerate(range(1900, 2025)):
            rows.append({
                "entity": code, "year": year, "period": 0,
                "series": "public_debt_to_gdp",
                "value": round(base * (0.5 + 0.5 * (j / 124.0)), 4),
            })
    return rows


def maddison() -> list[dict]:
    """GDP per capita, population, gdp_total, plus the WORLD total row.

    WORLD is what mart_world_power divides by. Omitting it would make the mart build
    green and empty, which is worse than failing, so it is generated here explicitly.
    """
    countries = ["United States", "China", "United Kingdom", "Netherlands"]
    rows = []
    for i, c in enumerate(countries):
        pc0, pop0 = [3000.0, 700.0, 2500.0, 2200.0][i], [10000.0, 400000.0, 25000.0, 3000.0][i]
        for j, year in enumerate(range(1820, 2023, 10)):
            pc, pop = pc0 * (1.02**j), pop0 * (1.01**j)
            rows += [
                {"entity": c, "year": year, "period": 0, "series": "gdp_per_capita", "value": round(pc, 4)},
                {"entity": c, "year": year, "period": 0, "series": "population", "value": round(pop, 4)},
                {"entity": c, "year": year, "period": 0, "series": "gdp_total", "value": round(pc * pop, 4)},
            ]
    for j, year in enumerate(range(1820, 2023, 10)):
        world_pc, world_pop = 1200.0 * (1.02**j), 1000000.0 * (1.012**j)
        rows.append({"entity": "WORLD", "year": year, "period": 0,
                     "series": "gdp_total", "value": round(world_pc * world_pop, 4)})
    return rows


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
    for name, fn in (("jst", jst), ("shiller", shiller), ("boe", boe),
                     ("maddison", maddison), ("imf_debt", imf_debt)):
        rows = fn()
        (OUT / f"{name}.json").write_text(json.dumps(rows))
        print(f"wrote {name}.json: {len(rows)} rows")


if __name__ == "__main__":
    main()
