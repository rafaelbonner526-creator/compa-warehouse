"""Generate synthetic Stripe CI fixtures.

CI must never call the Stripe API. These files mirror the shape of
extract_stripe.py's output, including the `livemode` flag, so mart_revenue's
test-vs-live separation is actually exercised: the fixture deliberately contains
BOTH live and test rows. A fixture with only live rows would let the guard pass
without ever being tried.

Deterministic. Run: uv run tests/fixtures/generate_stripe_fixture.py
"""

import json
from pathlib import Path

OUT = Path(__file__).parent / "stripe"
OUT.mkdir(parents=True, exist_ok=True)

# 2026-01-05 and 2026-04-05 as unix seconds
T1, T2, T3 = 1767571200, 1775347200, 1780531200

charges = [
    {"id": "ch_live_1", "amount": 500000, "amount_refunded": 0, "currency": "usd",
     "created": T1, "status": "succeeded", "paid": True, "refunded": False,
     "description": "Fixture build", "customer": "cus_live_1", "invoice": "in_live_1",
     "livemode": True},
    {"id": "ch_live_2", "amount": 5000, "amount_refunded": 0, "currency": "usd",
     "created": T2, "status": "succeeded", "paid": True, "refunded": False,
     "description": "Fixture retainer", "customer": "cus_live_1", "invoice": "in_live_2",
     "livemode": True},
    # test row: must never be counted as revenue
    {"id": "ch_test_1", "amount": 10000, "amount_refunded": 0, "currency": "usd",
     "created": T3, "status": "succeeded", "paid": True, "refunded": False,
     "description": "created by Testing Blueprints", "customer": "cus_test_1",
     "invoice": None, "livemode": False},
]
invoices = [
    {"id": "in_live_1", "amount_due": 500000, "amount_paid": 500000, "currency": "usd",
     "created": T1, "status": "paid", "customer": "cus_live_1", "subscription": None,
     "period_start": T1, "period_end": T1, "livemode": True},
    {"id": "in_live_2", "amount_due": 5000, "amount_paid": 5000, "currency": "usd",
     "created": T2, "status": "paid", "customer": "cus_live_1", "subscription": "sub_live_1",
     "period_start": T2, "period_end": T2, "livemode": True},
]
subscriptions = [
    {"id": "sub_live_1", "status": "active", "created": T2, "customer": "cus_live_1",
     "current_period_start": T2, "current_period_end": T3,
     "cancel_at_period_end": False, "livemode": True},
]
customers = [
    {"id": "cus_live_1", "created": T1, "email": "fixture@example.test",
     "name": "Fixture Clinic", "delinquent": False, "livemode": True},
    {"id": "cus_test_1", "created": T3, "email": "testaccount@example.com",
     "name": None, "delinquent": False, "livemode": False},
]

for name, rows in (("charges", charges), ("invoices", invoices),
                   ("subscriptions", subscriptions), ("customers", customers)):
    (OUT / f"{name}.json").write_text(json.dumps(rows))
    print(f"wrote {name}.json: {len(rows)} rows")
