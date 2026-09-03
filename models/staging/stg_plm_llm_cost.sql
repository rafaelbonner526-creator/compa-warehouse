-- PLM's own LLM spend, per day, as instrumented by Langfuse.
--
-- This is NOT the Anthropic bill. The card charges (see mart_component_spend)
-- total about $104 a month and cover Claude Code and personal use; Langfuse sees
-- only calls PLM made, about $3.60 a month. Both are true and answer different
-- questions. Reporting the card total as the cost of running PLM overstates it
-- roughly thirtyfold.
SELECT
    {{ try_cast_null('cost_date', 'date') }}        AS cost_date,
    {{ try_cast_null('total_cost_usd', 'numeric') }} AS total_cost_usd,
    {{ try_cast_null('traces', 'integer') }}        AS traces,
    {{ try_cast_null('observations', 'integer') }}  AS observations
FROM {{ source('bronze', 'plm_llm_cost') }}
WHERE cost_date IS NOT NULL AND trim(cost_date) != ''
