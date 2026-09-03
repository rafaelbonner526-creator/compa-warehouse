-- Exactly one budget target may be in force per category on any given day.
--
-- ORIGIN 2026-09-02: seeds/budget_targets.csv carries three Housing rows, because
-- the lease moved from 1600 to a 2081 September stub to 1444 ongoing. Targets are
-- correctly date-scoped in the seed, but mart_safe_to_spend summed EVERY row with
-- no effective-date filter. Housing alone contributed 5125, total_target came out
-- at 7549 against 5706 of average income, and the target savings rate was MINUS 32
-- percent. The morning brief printed "ahead of your -32% target" in plain English.
--
-- This test asserts the property that makes such a sum safe, rather than checking
-- one mart's output. Any category with overlapping effective ranges will be caught
-- here the moment the seed is edited, which is where the mistake actually enters.
WITH active AS (
    SELECT
        category_group,
        {{ try_cast_null('effective_from', 'date') }} AS effective_from,
        coalesce({{ try_cast_null('effective_to', 'date') }},
                 cast('2999-12-31' as date))         AS effective_to
    FROM {{ ref('budget_targets') }}
)
SELECT category_group, count(*) AS active_targets
FROM active
WHERE effective_from <= cast({{ today() }} as date)
  AND effective_to   >= cast({{ today() }} as date)
GROUP BY category_group
HAVING count(*) > 1
