"""Extract long-history research datasets to normalized landing files.

WHY THIS IS A SEPARATE PATH from extract_fred.py:
  - These are static academic datasets revised once a year at most, so they do not
    belong on the daily FRED cron.
  - The source files are large (the Bank of England workbook is ~27MB with 109
    sheets) and are cached under _cache/, which is gitignored. Only the small
    normalized output is loaded into the warehouse.

WHY LONG HISTORY AT ALL: a 20-year window cannot answer the questions the cycle
frameworks ask. Two concrete examples that motivated this module:
  - The 18-year property cycle could only be *asserted* from 39 years of
    Case-Shiller, because that window contains a single trough. 151 years across 18
    countries contains 85 of them, which makes the model testable instead.
  - CAPE at ~35 reads as "somewhat high" against 20 years and as the 97th
    percentile of 144 years, above the 1929 peak. Same number, opposite meaning.

Sources:
  Shiller  -- US stock market, monthly from 1871. Price, dividends, earnings, CPI,
              long rate, and CAPE. http://www.econ.yale.edu/~shiller/data.htm
  JST      -- Jordà-Schularick-Taylor Macrohistory Database. 18 advanced economies,
              annual 1870-2020: house prices, credit, debt/GDP, equity and bond
              returns. https://www.macrohistory.net
  BoE      -- "A millennium of macroeconomic data for the UK". Annual, some series
              from 1086, usably continuous from ~1700. This is the only source that
              reaches the 300-year mark.
  Maddison -- Maddison Project 2023. 169 countries, year 1 to 2022, GDP per capita
              and population. Added 2026-09-02 for the relative-power side of the
              Dalio framing: share of world GDP is one of his eight measures and
              JST cannot produce it. https://www.rug.nl/ggdc/historicaldevelopment/maddison
  IMF HPDD -- Historical Public Debt Database via the DataMapper API. ~190 economies,
              UK from 1800, through 2024. Added 2026-09-02 because JST covers
              advanced economies only, so China and Russia were invisible to a
              framework whose whole subject is rising and falling powers.

Output is tidy long format (entity, year, period, series, value) to match how
stg_fred is shaped, so one staging model per source stays trivial.

Run:  uv run ingestion/extract_longhistory.py
"""

import json
import os
import urllib.request
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

OUT = Path(
    os.getenv(
        "LONGHISTORY_LANDING_DIR",
        str(Path(__file__).parent.parent / "data" / "raw" / "longhistory"),
    )
)
CACHE = OUT / "_cache"

SOURCES = {
    "shiller.xls": "https://img1.wsimg.com/blobby/go/e5e77e0b-59d1-44d9-ab25-4763ac982e53/downloads/ie_data.xls",
    "jst.xlsx": "https://www.macrohistory.net/app/download/9834512569/JSTdatasetR6.xlsx",
    "boe.xlsx": "https://www.bankofengland.co.uk/-/media/boe/files/statistics/research-datasets/a-millennium-of-macroeconomic-data-for-the-uk.xlsx",
    # Maddison Project 2023. The rug.nl direct path 404s; Dataverse is the live
    # location and 303-redirects to a signed object-store URL.
    "maddison.xlsx": "https://dataverse.nl/api/access/datafile/421302",
}

# IMF Historical Public Debt Database, via the DataMapper API rather than a file.
# Indicator "d" is gross public debt as a percent of GDP and reaches much further
# back than the WEO series GGXWDG_NGDP: UK from 1800, Netherlands 1814, Russia 1885,
# USA 1929, and it runs to 2024. GGXWDG_NGDP only starts around 1980-2001 depending
# on country, so it is deliberately NOT used here.
IMF_DEBT_URL = "https://www.imf.org/external/datamapper/api/v1/d"

# BoE "A1. Headline series": column index -> series name. The sheet puts the human
# description on row 3 and the data from row 7, with the year in column 0. Columns
# are positional, so ASSERT_DESC below pins each one to the text we expect to keep a
# silent column shift in a future revision from quietly remapping every series.
BOE_COLS = {
    56: ("house_prices", "House price index"),
    40: ("cpi", "Consumer price index"),
    44: ("bank_rate", "Bank Rate"),
    47: ("long_rate", "Consols / long-term government bond yields"),
    51: ("share_prices", "Share prices"),
    22: ("nominal_gdp", "Nominal UK GDP at market prices"),
    72: ("public_debt", "UK Public sector debt"),
    27: ("unemployment", "Unemployment rate"),
}

JST_SERIES = {
    "hpnom": "house_prices_nominal",
    "cpi": "cpi",
    "gdp": "nominal_gdp",
    "debtgdp": "public_debt_to_gdp",
    "tloans": "total_loans",
    "ltrate": "long_rate",
    "stir": "short_rate",
    "eq_tr": "equity_total_return",
    "bond_tr": "bond_total_return",
}


def fetch(name: str, url: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name
    if p.exists() and p.stat().st_size > 100_000:
        print(f"  {name}: cached ({p.stat().st_size / 1e6:.1f}MB)")
        return p
    print(f"  {name}: downloading...")
    req = urllib.request.Request(url, headers={"User-Agent": "compa-warehouse/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        p.write_bytes(r.read())
    print(f"  {name}: {p.stat().st_size / 1e6:.1f}MB")
    return p


def do_shiller(path: Path) -> list[dict]:
    d = pd.read_excel(path, sheet_name="Data", header=7)
    d = d[pd.to_numeric(d["Date"], errors="coerce").notna()].copy()
    d["Date"] = pd.to_numeric(d["Date"])
    # Shiller encodes dates as YYYY.MM, so 1871.1 is October not January.
    d["year"] = d["Date"].astype(int)
    d["month"] = (d["Date"] * 100).round().astype(int) % 100
    cols = {
        "P": "price",
        "D": "dividend",
        "E": "earnings",
        "CPI": "cpi",
        "Rate GS10": "long_rate",
        "CAPE": "cape",
    }
    rows = []
    for src, name in cols.items():
        if src not in d.columns:
            print(f"    WARN shiller column missing: {src}")
            continue
        v = pd.to_numeric(d[src], errors="coerce")
        for year, month, val in zip(d["year"], d["month"], v):
            if pd.notna(val) and 1 <= month <= 12:
                rows.append(
                    {
                        "entity": "USA",
                        "year": int(year),
                        "period": int(month),
                        "series": name,
                        "value": float(val),
                    }
                )
    return rows


def do_jst(path: Path) -> list[dict]:
    d = pd.read_excel(path, sheet_name="Sheet1")
    rows = []
    for src, name in JST_SERIES.items():
        if src not in d.columns:
            print(f"    WARN jst column missing: {src}")
            continue
        v = pd.to_numeric(d[src], errors="coerce")
        for country, year, val in zip(d["country"], d["year"], v):
            if pd.notna(val):
                rows.append(
                    {
                        "entity": str(country),
                        "year": int(year),
                        "period": 0,  # annual
                        "series": name,
                        "value": float(val),
                    }
                )
    return rows


def do_boe(path: Path) -> list[dict]:
    raw = pd.read_excel(path, sheet_name="A1. Headline series", header=None)
    desc = raw.iloc[3].tolist()
    rows = []
    for idx, (name, expect) in BOE_COLS.items():
        got = str(desc[idx]) if idx < len(desc) else ""
        if not got.lower().startswith(expect.lower()[:18]):
            # Positional columns in a revised workbook would silently remap every
            # series, so refuse rather than emit plausible-looking wrong data.
            print(
                f"    SKIP boe col {idx} ({name}): expected '{expect}', found '{got[:44]}'"
            )
            continue
        years = pd.to_numeric(raw.iloc[7:, 0], errors="coerce")
        vals = pd.to_numeric(raw.iloc[7:, idx], errors="coerce")
        for year, val in zip(years, vals):
            if pd.notna(year) and pd.notna(val):
                rows.append(
                    {
                        "entity": "GBR",
                        "year": int(year),
                        "period": 0,
                        "series": name,
                        "value": float(val),
                    }
                )
    return rows


def do_maddison(path: Path) -> list[dict]:
    """Maddison Project 2023: 169 countries, year 1 to 2022, GDP per capita and
    population. This is the relative-power side of the Dalio framing: GDP share of
    the world is one of his eight measures, and it cannot be computed from JST,
    which covers 18 advanced economies only.

    Emits gdp_per_capita and population as separate series, plus a derived
    gdp_total, because share-of-world needs the level rather than the per-head
    figure.
    """
    d = pd.read_excel(path, sheet_name="Full data")
    required = {"country", "year", "gdppc", "pop"}
    missing = required - set(d.columns)
    if missing:
        # Same refusal the BoE loader makes: a renamed column in a future revision
        # would silently produce plausible, wrong numbers.
        print(f"    SKIP maddison: expected columns missing: {sorted(missing)}")
        return []

    rows = []
    gdppc = pd.to_numeric(d["gdppc"], errors="coerce")
    pop = pd.to_numeric(d["pop"], errors="coerce")
    for country, year, pc, pp in zip(d["country"], d["year"], gdppc, pop):
        if pd.isna(year):
            continue
        y = int(year)
        if pd.notna(pc):
            rows.append({"entity": str(country), "year": y, "period": 0,
                         "series": "gdp_per_capita", "value": float(pc)})
        if pd.notna(pp):
            rows.append({"entity": str(country), "year": y, "period": 0,
                         "series": "population", "value": float(pp)})
        if pd.notna(pc) and pd.notna(pp):
            # Maddison population is in thousands, so this is millions of 2011$.
            rows.append({"entity": str(country), "year": y, "period": 0,
                         "series": "gdp_total", "value": float(pc) * float(pp)})

    ents = {r["entity"] for r in rows}
    for must in ("China", "Russian Federation", "United States"):
        if must not in ents:
            print(f"    WARN maddison: expected country absent: {must}")
    return rows


def do_imf_debt() -> list[dict]:
    """IMF Historical Public Debt Database via DataMapper.

    WHY THIS AND NOT JST: JST is 18 advanced economies ending 2020. A framework
    about rising and falling powers that cannot see China or Russia is missing the
    rival, which is the entire point. This reaches 1800 for the UK and runs to 2024.

    CHINA STARTS AT 1984. That is a real limitation, not a bug: any "percentile of
    own history" for China is over ~40 years, against 225 for the UK. The mart emits
    years_on_record so the difference is visible rather than assumed away.
    """
    # IMF's edge rejects unrecognised user agents. Verified 2026-09-02: three
    # consecutive 403s for "compa-warehouse/1.0" and for "Mozilla/5.0", while
    # curl/*, wget/* and python-urllib/* all return 200. Sending a conventional
    # agent is the only thing that works, so it is deliberate rather than sloppy.
    req = urllib.request.Request(IMF_DEBT_URL, headers={"User-Agent": "curl/8.7.1"})
    with urllib.request.urlopen(req, timeout=180) as r:
        payload = json.loads(r.read())
    series = (payload.get("values") or {}).get("d") or {}
    if not series:
        print("    SKIP imf_debt: API returned no values for indicator 'd'")
        return []

    rows, dropped = [], 0
    for code, obs in series.items():
        if not isinstance(obs, dict):
            continue
        for year, val in obs.items():
            try:
                y, v = int(year), float(val)
            except (TypeError, ValueError):
                continue
            # Debt/GDP outside 0-1000% is not a real observation. Zimbabwe-scale
            # crises top out well under this; anything beyond is a units or parse
            # fault and must not reach the warehouse.
            if v < 0 or v > 1000:
                dropped += 1
                continue
            rows.append({"entity": str(code), "year": y, "period": 0,
                         "series": "public_debt_to_gdp", "value": v})
    if dropped:
        print(f"    imf_debt: dropped {dropped} implausible observations (outside 0-1000%)")
    for must in ("CHN", "RUS", "USA", "GBR"):
        if not any(r["entity"] == must for r in rows):
            print(f"    WARN imf_debt: expected country absent: {must}")
    return rows


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for out_name, (src_name, fn) in {
        "shiller": ("shiller.xls", do_shiller),
        "jst": ("jst.xlsx", do_jst),
        "boe": ("boe.xlsx", do_boe),
        "maddison": ("maddison.xlsx", do_maddison),
    }.items():
        print(f"{out_name}:")
        p = fetch(src_name, SOURCES[src_name])
        rows = fn(p)
        (OUT / f"{out_name}.json").write_text(json.dumps(rows))
        if rows:
            yrs = [r["year"] for r in rows]
            ents = {r["entity"] for r in rows}
            sers = sorted({r["series"] for r in rows})
            print(
                f"  -> {len(rows)} rows | {min(yrs)}-{max(yrs)} "
                f"| {len(ents)} entities | series: {', '.join(sers)}"
            )

    # IMF is an API rather than a cached file, so it sits outside the loop above.
    print("imf_debt:")
    rows = do_imf_debt()
    (OUT / "imf_debt.json").write_text(json.dumps(rows))
    if rows:
        yrs = [r["year"] for r in rows]
        ents = {r["entity"] for r in rows}
        print(f"  -> {len(rows)} rows | {min(yrs)}-{max(yrs)} | {len(ents)} entities")


if __name__ == "__main__":
    main()
