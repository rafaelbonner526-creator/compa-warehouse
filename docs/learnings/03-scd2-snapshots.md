# 03 - dim_lead with SCD-2 (dbt snapshots)

**Session 3** - 2026-08-12

Added an SCD-2 snapshot on leads so the warehouse keeps status history instead
of overwriting it.

- **The problem**: bronze and silver only hold a lead's *current* status; each refresh destroys the past. History is what analytics needs (status at a point in time, time-in-stage, funnel velocity).
- **SCD-2 via dbt snapshot**: each run compares `stg_leads` to the last capture; when `status` changes, dbt closes the old row (sets `dbt_valid_to`) and inserts a new current one (`dbt_valid_to` null). One lead becomes many time-boxed rows.
- **Config**: snapshot `stg_leads`, `unique_key: lead_id`, `strategy: check`, `check_cols: [status]`.
- **Verified**: changed one lead `follow_up_3 -> replied_positive` through the pipeline; the lead split into a closed row and a new current row, with the old `valid_to` exactly equal to the new `valid_from` (continuous timeline, no gap or overlap).
- **Caveat**: the source holds only current state, so history accrues forward from the first snapshot. Production runs `dbt snapshot` on a schedule.

Next: gold marts (funnel metrics) + orchestration.
