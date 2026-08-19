"""Generate the synthetic FRED CI fixture (tests/fixtures/fred/observations.json).

Fully fake data shaped like the real FRED landing file, one row per
(series, date) with string values, matching extract_fred.py's output.

Dates are emitted RELATIVE TO TODAY at generation time, on purpose: the macro
marts filter on windows anchored to current_date (mart_macro_history: 180 days)
and compute YoY off the latest observation. The previous fixture used fixed
2025-01 dates, so by the time CI ran it every macro mart built successfully
while returning all NULLs -- a green build that proved nothing about the logic.

Re-run this and commit the output if the macro marts start coming back empty in
CI:  uv run tests/fixtures/generate_fred_fixture.py

Values are deterministic (no randomness) so a regeneration on the same day is
byte-identical.
"""

import json
from datetime import date
from pathlib import Path

OUT = Path(__file__).parent / "fred"
OUT.mkdir(parents=True, exist_ok=True)

MONTHS_BACK = 30  # > 15 so YoY and YoY-3-months-ago both resolve

# name -> (series_id, base value, per-month drift). Drift makes YoY, the 90-day
# change and the capacity gap all non-zero, so the marts compute real numbers.
SERIES = {
    "oil_wti": ("DCOILWTICO", 70.0, -0.30),
    "cpi": ("CPIAUCSL", 300.0, 0.70),
    "commodities": ("PPIACO", 250.0, 0.40),
    "fed_funds": ("DFF", 4.50, -0.02),
    "bond_10y": ("DGS10", 4.20, 0.01),
    "yield_curve_10y2y": ("T10Y2Y", 0.30, 0.01),
    "industrial_production": ("INDPRO", 102.0, 0.15),
    "corp_baa": ("BAA", 5.80, 0.01),
    "capacity_utilization": ("TCU", 77.0, 0.05),
    "debt_to_gdp": ("GFDEGDQ188S", 118.0, 0.25),
    "house_prices": ("CSUSHPINSA", 300.0, 1.20),
    "dollar_index": ("DTWEXBGS", 120.0, -0.08),
    "real_rate_10y": ("DFII10", 2.00, 0.02),
    "foreign_treasury": ("FDHBFIN", 9000.0, 12.0),
    "policy_uncertainty": ("USEPUINDXD", 150.0, 1.10),
    "global_policy_uncertainty": ("GEPUCURRENT", 200.0, 1.40),
    "financial_stress": ("STLFSI4", -0.50, -0.01),
    "vix": ("VIXCLS", 18.0, -0.10),
    "recession_prob": ("RECPROUSM156N", 1.0, 0.02),
}


def month_starts(n: int) -> list[str]:
    """First of the month for the last n months, oldest first."""
    today = date.today()
    out = []
    y, m = today.year, today.month
    for _ in range(n):
        out.append(date(y, m, 1).isoformat())
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(out))


# house_prices gets a V shape rather than a straight ramp: it falls for the first
# TROUGH_AT months, then rises. Without a real interior minimum, mart_property_cycle
# would locate its "trough" at the first observation and the trough-finding logic
# would never actually be exercised by CI.
TROUGH_AT = 8


def value_for(name: str, base: float, drift: float, i: int) -> float:
    if name == "house_prices":
        return base - drift * i if i <= TROUGH_AT else base - drift * TROUGH_AT + drift * (i - TROUGH_AT)
    return base + drift * i


def main() -> None:
    dates = month_starts(MONTHS_BACK)
    rows = []
    for name, (sid, base, drift) in SERIES.items():
        for i, d in enumerate(dates):
            rows.append(
                {
                    "series": name,
                    "series_id": sid,
                    "date": d,
                    "value": f"{value_for(name, base, drift, i):.2f}",
                }
            )
    (OUT / "observations.json").write_text(json.dumps(rows))
    print(f"wrote {len(rows)} observations ({len(SERIES)} series x {len(dates)} months)")


if __name__ == "__main__":
    main()
