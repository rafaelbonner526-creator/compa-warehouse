"""Generate small, synthetic CI fixtures matching the real source schema.

Fully fake data, internally consistent so it passes the dbt tests:
- unique/not_null lead_id + touch_id
- every touch.lead_id exists in leads (relationships)
- channel in {call, email, linkedin} (accepted_values)

Deterministic: no randomness, so CI runs are reproducible.
"""
from pathlib import Path
import pandas as pd

OUT = Path(__file__).parent / "leads"
OUT.mkdir(parents=True, exist_ok=True)

LEAD_COLS = ["id","name","practice_name","specialty","city","state","website",
    "email","found_date","source","status","content_signals","linkedin_url",
    "linkedin_active","community_platform","audience_size_estimate",
    "angle_assigned","cohort","last_touch_date","next_action_date","has_team",
    "operator_visible","email_list","contact_type","segment","notes"]

statuses = ["qualified","warm","copy_ready","sent","follow_up_1","follow_up_2",
    "replied","replied_positive","enriched","disqualified"]
leads = []
for i in range(1, 11):
    leads.append({
        "id": i, "name": f"Dr. Test Lead {i}",
        "practice_name": f"Fixture Health {i}", "specialty": "Functional Medicine",
        "city": "Testville", "state": "TX",
        "website": f"https://example{i}.test", "email": f"lead{i}@example.test",
        "found_date": "2026-01-15", "source": "fixture",
        "status": statuses[(i - 1) % len(statuses)],
        "content_signals": "blog, newsletter", "linkedin_url": "",
        "linkedin_active": ["true","false","yes",""][i % 4],
        "community_platform": "", "audience_size_estimate": "medium",
        "angle_assigned": ["A","B","C",""][i % 4], "cohort": "fixture-2026",
        "last_touch_date": "2026-02-01", "next_action_date": "2026-02-10",
        "has_team": ["Y","N"][i % 2], "operator_visible": ["Y","N"][i % 2],
        "email_list": ["Y","N","personal"][i % 3], "contact_type": "personal",
        "segment": ["A","B","C"][i % 3],
        "notes": f"synthetic fixture row {i}, safe to commit",
    })
pd.DataFrame(leads, columns=LEAD_COLS).to_csv(OUT / "leads-master.csv", index=False)

TOUCH_COLS = ["touch_id","lead_id","date","channel","touch_number","angle",
    "subject_line","replied","reply_sentiment","objection_tag","notes","opened"]
channels = ["email","call","linkedin"]
touches = []
tid = 0
for lead_id in range(1, 11):
    for n in range(1, (lead_id % 3) + 1):  # 1-2 touches per lead
        tid += 1
        touches.append({
            "touch_id": f"{tid}-2026020{n}", "lead_id": lead_id,
            "date": f"2026-02-0{n}", "channel": channels[tid % 3],
            "touch_number": n, "angle": ["A","B","C",""][lead_id % 4],
            "subject_line": f"fixture subject {tid}",
            "replied": "yes" if tid % 5 == 0 else "no",
            "reply_sentiment": "", "objection_tag": "",
            "notes": f"fixture touch {tid}",
            "opened": "yes" if tid % 2 == 0 else "no",
        })
pd.DataFrame(touches, columns=TOUCH_COLS).to_csv(OUT / "touch-log.csv", index=False)
print(f"wrote {len(leads)} leads, {len(touches)} touches to {OUT}")
