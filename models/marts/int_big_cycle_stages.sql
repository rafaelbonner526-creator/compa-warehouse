-- The six stages of Dalio's long-term debt cycle, defined ONCE.
--
-- WHY THIS MODEL EXISTS: the stage bands were written inline in mart_big_cycle,
-- which was fine while the US was the only thing scored. The moment a second
-- consumer appeared (mart_big_cycle_comparative, 18 countries) that inline table
-- would have been copy-pasted, and two copies of a threshold table drift. The
-- header of mart_big_cycle already warned about exactly this, noting that the
-- skill's stage 3/4 ranges overlapped and had to be reconciled.
--
-- Bands are contiguous and non-overlapping. They come from the empire-health-monitor
-- skill (COMPA/.claude/skills/empire-health-monitor/SKILL.md); if they change there,
-- they change here, and nowhere else.
--
-- Stage 6 is not detectable from debt-to-GDP alone and is never auto-selected.
SELECT 1 AS stage_order, 'New world order' AS stage_name, 0.0 AS debt_min, 60.0 AS debt_max,
       'New reserve currency established, low debt, strong currency' AS description,
       'Standard allocation, no debasement hedge needed' AS implication
UNION ALL SELECT 2, 'Peace and prosperity', 60.0, 80.0,
       'Growth-fueled expansion, debt still manageable', 'Standard allocation'
UNION ALL SELECT 3, 'Debt bubble', 80.0, 100.0,
       'Debt accumulating, financial engineering rising', 'Monitor, slight gold bias'
UNION ALL SELECT 4, 'Top of cycle', 100.0, 130.0,
       'Peak power, internal conflict rising, rival emerging', 'Validate gold toward cap, international bias'
UNION ALL SELECT 5, 'Decline', 130.0, 999.0,
       'Debt monetization, currency weakness, reserve status eroding', 'Max gold within cap, heavy international bias'
UNION ALL SELECT 6, 'New world order (next)', 999.0, 9999.0,
       'Reserve currency transfer complete', 'Outside framework scope'
