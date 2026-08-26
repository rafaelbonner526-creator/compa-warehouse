"""Extract Monarch data to JSON landing files (Engine A / budget).

Runs in the monarch-mcp venv (keychain auth), read-only. Writes raw record
arrays to data/raw/monarch/ for the dlt loader to pick up. Two-stage on
purpose: the Monarch session lives in its own venv, separate from the
warehouse (dlt/dbt) venv.

Run:
  /Users/rafaelbonner/.venvs/monarch-mcp/bin/python ingestion/extract_monarch.py
"""

import asyncio
import json
from datetime import date, timedelta
from pathlib import Path

from monarch_mcp.secure_session import secure_session

OUT = Path(__file__).parent.parent / "data" / "raw" / "monarch"
OUT.mkdir(parents=True, exist_ok=True)

LOOKBACK_DAYS = 400  # ~13 months, enough for rolling-window budget + trends


def dump(name: str, records: list) -> None:
    (OUT / f"{name}.json").write_text(json.dumps(records, indent=2, default=str))
    print(f"  {name}: {len(records)} records -> {name}.json")


async def with_retry(what: str, call, attempts: int = 4, delay: float = 2.0):
    """Retry a Monarch GraphQL call. Monarch 502s and times out intermittently.

    The holdings loop has carried an inline version of this since it was written.
    The transactions pager did not, and on 2026-08-26 a single gql TimeoutError
    there killed a run in which accounts, categories, recurring, networth and
    holdings had ALL already succeeded. Exponential so a slow-but-alive backend
    gets a real chance rather than four rapid retries inside its stall.
    """
    for attempt in range(attempts):
        try:
            return await call()
        except Exception as ex:  # noqa: BLE001
            if attempt == attempts - 1:
                raise
            wait = delay * (2**attempt)
            print(
                f"  {what}: {type(ex).__name__}, retry {attempt + 1}/{attempts - 1} in {wait:.0f}s"
            )
            await asyncio.sleep(wait)


async def main() -> None:
    mm = secure_session.get_authenticated_client()
    if mm is None:
        raise SystemExit("Monarch auth needed (run the MCP auth flow first)")

    acc = await mm.get_accounts()
    dump("accounts", acc.get("accounts", []) if isinstance(acc, dict) else acc)

    cat = await mm.get_transaction_categories()
    dump("categories", cat.get("categories", []) if isinstance(cat, dict) else cat)

    rec = await mm.get_recurring_transactions()
    if isinstance(rec, dict):
        rec = rec.get("recurringTransactionItems") or rec.get("recurring") or []
    dump("recurring", rec if isinstance(rec, list) else [])

    snap = await mm.get_aggregate_snapshots()
    snaps = snap.get("aggregateSnapshots", snap) if isinstance(snap, dict) else snap
    dump("networth", snaps if isinstance(snaps, list) else [])

    # holdings across investment accounts (for portfolio signals)
    all_accts = acc.get("accounts", []) if isinstance(acc, dict) else acc
    inv = [
        a for a in all_accts if (a.get("type") or {}).get("display") == "Investments"
    ]
    holdings = []
    for a in inv:
        try:
            h = None
            for attempt in range(4):  # Monarch occasionally 502s; retry
                try:
                    h = await mm.get_account_holdings(a["id"])
                    break
                except Exception:  # noqa: BLE001
                    if attempt == 3:
                        raise
                    await asyncio.sleep(2)
            edges = (
                ((h or {}).get("portfolio") or {}).get("aggregateHoldings") or {}
            ).get("edges") or []
            for e in edges:
                n = e.get("node") or {}
                sec = n.get("security") or {}
                # Monarch leaves security.ticker null on securities it has not fully
                # matched yet, but the position under node.holdings still carries it.
                # Falling back matters: a null ticker silently fails the join to
                # seeds/security_map, so the holding quietly takes default region /
                # asset_class / sleeve instead of its mapped ones, and disappears
                # from any ticker-based display. XOM sat in exactly this state.
                pos = (n.get("holdings") or [{}])[0]
                ticker = sec.get("ticker") or pos.get("ticker")
                holdings.append(
                    {
                        "account": a.get("displayName"),
                        "account_id": a.get("id"),
                        "ticker": ticker,
                        "name": sec.get("name") or pos.get("name"),
                        "security_type": sec.get("type")
                        or sec.get("typeDisplay")
                        or pos.get("type"),
                        "market_value": n.get("totalValue"),
                        "quantity": n.get("quantity"),
                        "basis": n.get("basis"),
                        "change_pct": n.get("securityPriceChangePercent"),
                    }
                )
        except Exception as ex:  # noqa: BLE001
            print(f"  holdings {a.get('displayName')} error: {ex}")
    dump("holdings", holdings)

    # transactions: paginate the lookback window
    start = (date.today() - timedelta(days=LOOKBACK_DAYS)).isoformat()
    today = date.today().isoformat()
    txns: list = []
    offset, page = 0, 100
    while True:
        r = await with_retry(
            f"transactions offset={offset}",
            lambda: mm.get_transactions(
                limit=page, offset=offset, start_date=start, end_date=today
            ),
        )
        block = r.get("allTransactions", r) if isinstance(r, dict) else {}
        results = block.get("results", []) if isinstance(block, dict) else []
        txns.extend(results)
        if len(results) < page:
            break
        offset += page
    dump("transactions", txns)

    if txns:
        print("  sample txn keys:", sorted(txns[0].keys()))


if __name__ == "__main__":
    asyncio.run(main())
