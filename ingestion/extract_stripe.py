"""Extract Stripe revenue objects to normalized landing files.

WHY A SEPARATE PATH: Stripe is the only source that reflects the Ampwell venture
rather than personal finance, and it is the one that answers the question with a
date attached: 2-3 real-money clients by 2027-02-10 (decision logged 2026-08-10).

KEY SELECTION, in order of preference:
    STRIPE_RESTRICTED_KEY   rk_live_... read-only. This is what should be used.
    STRIPE_SECRET_KEY       sk_test_/sk_live_ full-privilege fallback.

A full secret key can create charges, issue refunds and delete customers. A
dashboard needs none of that. If you are pointing this at live data, make a
restricted key (Stripe Dashboard -> Developers -> API keys -> Create restricted
key) with read access to Charges, Invoices, Subscriptions and Customers, and put
it in STRIPE_RESTRICTED_KEY.

LIVEMODE IS CARRIED THROUGH DELIBERATELY. A test-mode key returns real-looking
objects with livemode=false; the sample data ships with a $100 charge from
"Testing Blueprints". Presenting that as revenue would be worse than showing
nothing, so every row records livemode and the marts refuse to count test rows
as revenue.

Run:  set -a; source .env; set +a; uv run ingestion/extract_stripe.py
"""

import base64
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

OUT = Path(
    os.getenv(
        "STRIPE_LANDING_DIR",
        str(Path(__file__).parent.parent / "data" / "raw" / "stripe"),
    )
)

def _key() -> str:
    """Resolved lazily so load_stripe.py can import ENDPOINTS without credentials."""
    k = os.getenv("STRIPE_RESTRICTED_KEY") or os.getenv("STRIPE_SECRET_KEY")
    if not k:
        raise RuntimeError(
            "No Stripe key. Set STRIPE_RESTRICTED_KEY (preferred, read-only) "
            "or STRIPE_SECRET_KEY in .env."
        )
    return k

# id -> the fields we keep. Everything else Stripe returns is dropped at the edge
# rather than warehoused, because most of it is PII or payment-method detail this
# dashboard has no business storing.
ENDPOINTS = {
    "charges": (
        "charges",
        [
            "id",
            "amount",
            "amount_refunded",
            "currency",
            "created",
            "status",
            "paid",
            "refunded",
            "description",
            "customer",
            "invoice",
            "livemode",
        ],
    ),
    "invoices": (
        "invoices",
        [
            "id",
            "amount_due",
            "amount_paid",
            "currency",
            "created",
            "status",
            "customer",
            "subscription",
            "period_start",
            "period_end",
            "livemode",
        ],
    ),
    "subscriptions": (
        "subscriptions",
        [
            "id",
            "status",
            "created",
            "customer",
            "current_period_start",
            "current_period_end",
            "cancel_at_period_end",
            "livemode",
        ],
    ),
    "customers": (
        "customers",
        ["id", "created", "email", "name", "delinquent", "livemode"],
    ),
}


def fetch_all(path: str, fields: list[str]) -> list[dict]:
    """Page through a Stripe list endpoint until exhausted."""
    auth = base64.b64encode((_key() + ":").encode()).decode()
    rows: list[dict] = []
    starting_after = None
    while True:
        q = {"limit": 100}
        if starting_after:
            q["starting_after"] = starting_after
        # subscriptions default to active-only; we want cancelled history too
        if path == "subscriptions":
            q["status"] = "all"
        url = f"https://api.stripe.com/v1/{path}?" + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
        data = json.loads(urllib.request.urlopen(req, timeout=45).read())
        batch = data.get("data", [])
        for r in batch:
            rows.append({f: r.get(f) for f in fields})
        if not data.get("has_more") or not batch:
            break
        starting_after = batch[-1]["id"]
    return rows


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    key = _key()
    mode = (
        "restricted"
        if key.startswith("rk_")
        else "TEST"
        if key.startswith("sk_test")
        else "LIVE"
        if key.startswith("sk_live")
        else "unknown"
    )
    print(f"stripe key mode: {mode}")
    for name, (path, fields) in ENDPOINTS.items():
        rows = fetch_all(path, fields)
        (OUT / f"{name}.json").write_text(json.dumps(rows))
        live = sum(1 for r in rows if r.get("livemode"))
        print(f"  {name}: {len(rows)} rows ({live} livemode, {len(rows) - live} test)")


if __name__ == "__main__":
    main()
