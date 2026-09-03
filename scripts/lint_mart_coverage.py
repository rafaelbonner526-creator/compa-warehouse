#!/usr/bin/env python3
"""Every gold mart must reach a human surface, or say why not.

WHY THIS EXISTS
---------------
2026-09-03: Rafa asked why the morning brief contained nothing from his
dashboard. Nothing was broken. The dashboard route and the morning digest each
hardcode their own list of marts, so the two Dalio marts built the day before
were wired into the dashboard and the digest was never told. The brief's whole
market section read 2 marts; the dashboard read 17. Fifteen marts had never
appeared in the brief, and no test compared the two lists.

A mart nobody reads is not free. It is built every morning, it costs query time,
and worse, it reads as delivered when it is not. This gate makes the omission
loud at the moment a mart is added instead of whenever someone happens to notice.

The ignore list is deliberately a dict of reasons, not a set of names. "Why is
this unread" is the question, and a name with no answer next to it is how the
list becomes a graveyard.

Usage:
    python3 scripts/lint_mart_coverage.py
Exit 0 = every mart is read somewhere or explicitly excused. Exit 1 = names them.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MART_DIR = ROOT / "models" / "marts"
DIGEST = ROOT / "scripts" / "morning_digest.py"
API_DIR = ROOT / "web" / "app" / "api"

# A mart may be unread by BOTH surfaces only with a stated reason.
MART_COVERAGE_IGNORE = {
    "mart_review_snapshot":
        "snapshot input for mart_review_digest, not a display surface",
    "mart_account_balances":
        "UNREAD AND UNDECIDED as of 2026-09-03. Found by this gate on its first "
        "run. A thin passthrough of stg_accounts, referenced only in "
        "docs/learnings/10-finance-marts-dashboard.md, absent from _marts.yml, "
        "and read by no route, page or digest. Left building rather than deleted "
        "because per-account balances are a plausible panel and deleting a model "
        "to make a gate green is how coverage gates start lying. Decide: surface "
        "it or drop it.",
}


def mart_names():
    """Gold marts only. int_* are intermediates and fact_* are not display marts."""
    return sorted(p.stem for p in MART_DIR.glob("mart_*.sql"))


def read_all(paths):
    out = []
    for p in paths:
        try:
            out.append(p.read_text())
        except OSError:
            continue
    return "\n".join(out)


def main():
    marts = mart_names()
    if not marts:
        print("FAIL: no marts found -- is this the right directory?", file=sys.stderr)
        return 1

    digest_src = read_all([DIGEST])
    api_src = read_all(sorted(API_DIR.rglob("route.ts")))

    # Word-boundary match, so mart_big_cycle does NOT satisfy
    # mart_big_cycle_comparative. That substring collision is the whole reason
    # this gate could otherwise pass while the comparative mart went unread.
    def referenced(name, src):
        return re.search(rf"\b{re.escape(name)}\b", src) is not None

    uncovered = []
    for m in marts:
        in_digest = referenced(m, digest_src)
        in_api = referenced(m, api_src)
        if in_digest or in_api:
            continue
        if m in MART_COVERAGE_IGNORE:
            continue
        uncovered.append(m)

    stale_excuses = [m for m in MART_COVERAGE_IGNORE if m not in marts]

    # SECOND CHECK, REPORT-ONLY: a payload key served by an API route that no
    # page ever reads. Found on 2026-09-03 when this gate passed green while the
    # baselines mart sat in /api/investing with nothing rendering it: "reaches
    # the dashboard" had quietly come to mean "reaches the dashboard's server",
    # which is not what a person sees.
    #
    # Report-only on purpose. The route-key to page-usage link is a heuristic
    # (keys are referenced as d.key, data.key, destructured, or renamed), and a
    # gate that fires on a false positive gets switched off within a week. It
    # earns promotion to blocking after it has been quiet against real traffic.
    page_src = read_all(sorted((ROOT / "web" / "app").rglob("page.tsx")))
    unrendered = []
    for route in sorted(API_DIR.rglob("route.ts")):
        try:
            src = route.read_text()
        except OSError:
            continue
        m = re.search(r"return NextResponse\.json\(\{(.*?)\}\)", src, re.S)
        if not m:
            continue
        for raw in m.group(1).split(","):
            key = raw.split(":")[0].strip()
            if not key or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                continue
            if key in ("error",):
                continue
            if not re.search(rf"\b{re.escape(key)}\b", page_src):
                unrendered.append(f"{route.parent.name}: {key}")

    brief_only = [m for m in marts if referenced(m, digest_src) and not referenced(m, api_src)]
    dash_only = [m for m in marts if referenced(m, api_src) and not referenced(m, digest_src)]

    print(f"marts: {len(marts)}")
    print(f"  read by the brief:     {sum(referenced(m, digest_src) for m in marts)}")
    print(f"  read by the dashboard: {sum(referenced(m, api_src) for m in marts)}")
    print(f"  brief only:            {len(brief_only)}")
    print(f"  dashboard only:        {len(dash_only)}")
    print(f"  excused:               {len(MART_COVERAGE_IGNORE)}")
    # Printed on every run, green or not. An excuse nobody re-reads is a
    # graveyard, and the point of the reason string is that someone sees it.
    for name, why in sorted(MART_COVERAGE_IGNORE.items()):
        print(f"    {name}: {why}")

    rc = 0
    if uncovered:
        print("\nFAIL: these marts are built every morning and read by nothing.")
        print("Add them to the brief, to a dashboard route, or to")
        print("MART_COVERAGE_IGNORE with a reason:")
        for m in uncovered:
            print(f"  {m}")
        rc = 1
    if stale_excuses:
        print("\nFAIL: MART_COVERAGE_IGNORE names marts that no longer exist.")
        print("An excuse outliving its mart hides the next real gap:")
        for m in stale_excuses:
            print(f"  {m}")
        rc = 1
    if unrendered:
        print("\nNOTE (report-only): served by an API route, referenced by no page.")
        print("The data reaches the server and never reaches a human:")
        for u in unrendered:
            print(f"  {u}")

    if rc == 0:
        print("\nPASS: every mart is read somewhere, or excused with a reason.")
    return rc


if __name__ == "__main__":
    sys.exit(main())
