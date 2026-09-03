-- Dalio Big Cycle (50-75 year long-term debt cycle) position.
--
-- Emits all six stages as rows with the current one flagged, so the UI can draw a
-- timeline rather than just a label.
--
-- Stage thresholds live in int_big_cycle_stages, which is the ONLY definition.
-- Extracted there 2026-09-02 when mart_big_cycle_comparative became a second
-- consumer. Originally lifted from the empire-health-monitor skill
-- (COMPA/.claude/skills/empire-health-monitor/SKILL.md) so there is one definition
-- of the stage model, not two that drift. The skill's stage 3/4 ranges overlapped
-- (80-120 and >100); resolved here to contiguous non-overlapping bands and the
-- resolution is recorded in that skill.
--
-- Stage 6 is not detectable from debt-to-GDP and is never auto-selected.
WITH stages AS (SELECT * FROM {{ ref('int_big_cycle_stages') }}),
d AS (SELECT debt_to_gdp, debt_to_gdp_chg_1y FROM {{ ref('mart_macro_equilibrium') }})
SELECT
    s.stage_order,
    s.stage_name,
    s.description,
    s.implication,
    s.debt_min,
    s.debt_max,
    d.debt_to_gdp,
    d.debt_to_gdp_chg_1y,
    CASE
        WHEN d.debt_to_gdp IS NULL THEN false
        WHEN s.stage_order = 6 THEN false
        ELSE d.debt_to_gdp >= s.debt_min AND d.debt_to_gdp < s.debt_max
    END AS is_current,
    CASE
        WHEN d.debt_to_gdp IS NULL      THEN 'unknown'
        WHEN d.debt_to_gdp < 100.0      THEN 'low'
        WHEN d.debt_to_gdp < 130.0      THEN 'medium'
        ELSE 'high'
    END AS debasement_risk
FROM stages s
CROSS JOIN d
ORDER BY s.stage_order
