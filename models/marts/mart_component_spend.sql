-- What the tooling actually costs, per component, from money that really left the
-- account.
--
-- SOURCE IS MONARCH, NOT VENDOR APIS. Every component here already appears as a
-- card charge in transactions the warehouse ingests, so this needs no new API
-- keys, no new failure modes, and no vendor's own reporting of what it thinks it
-- charged. It is the bank's version of events.
--
-- TWO NUMBERS THAT MUST NOT BE CONFLATED. `spend_usd` is what was CHARGED.
-- `plm_attributed_usd`, present only for Claude, is what PLM actually CAUSED,
-- measured by Langfuse. The Anthropic card charges run about $104 a month while
-- PLM's instrumented calls cost about $3.60: roughly 96% of that bill is Claude
-- Code and personal use. Reporting the charge as the cost of running PLM
-- overstates it nearly thirtyfold, which would poison any unit-economics or
-- pricing conversation built on it.
--
-- `serves` separates PLM from outreach from marketplace, because "what does the
-- business spend on tooling" and "what does PLM cost to run" are different
-- questions and the same table has to answer both without being re-read wrong.
WITH txns AS (
    SELECT
        LOWER(merchant) AS merchant_lc,
        txn_date,
        ABS(amount) AS amount
    FROM {{ ref('stg_transactions') }}
    WHERE amount < 0            -- money out only; refunds must not net silently
),
-- LEFT JOIN FROM THE COMPONENT LIST, not an inner join from transactions.
-- A component with no matching charge must still appear, showing zero and
-- flagged unmatched. The first version inner-joined and Supabase vanished from
-- the output entirely: it is in the component list, it has no card charge under
-- that name, and the result silently read as though the component did not exist.
-- Absent-because-free and absent-because-the-matcher-missed-it are different
-- states and both need to be visible, which is the same empty-vs-unknown
-- distinction this project keeps having to relearn.
mapped AS (
    SELECT
        c.component, c.serves, c.cost_type, c.note,
        t.txn_date, t.amount
    FROM {{ ref('spend_components') }} c
    LEFT JOIN txns t
      ON t.merchant_lc LIKE '%' || c.match_pattern || '%'
),
per_component AS (
    SELECT
        component,
        MAX(serves)    AS serves,
        MAX(cost_type) AS cost_type,
        MAX(note)      AS note,
        COUNT(amount)  AS charges,
        ROUND(COALESCE(SUM(amount), 0), 2) AS spend_usd,
        MIN(txn_date)  AS first_charge,
        MAX(txn_date)  AS last_charge,
        -- Trailing 90 days, so a component that was cancelled months ago does not
        -- read as an ongoing cost.
        ROUND(COALESCE(SUM(CASE WHEN txn_date >= {{ dbt.dateadd('day', -90, 'current_date()') }}
                       THEN amount ELSE 0 END), 0), 2) AS spend_90d
    FROM mapped
    GROUP BY component
),
-- PLM's instrumented LLM spend, the only component where charged and caused
-- differ enough to matter.
llm AS (
    SELECT
        ROUND(SUM(total_cost_usd), 2) AS plm_llm_total,
        ROUND(SUM(CASE WHEN cost_date >= {{ dbt.dateadd('day', -90, 'current_date()') }}
                       THEN total_cost_usd ELSE 0 END), 2) AS plm_llm_90d,
        MIN(cost_date) AS llm_from,
        MAX(cost_date) AS llm_to
    FROM {{ ref('stg_plm_llm_cost') }}
)
SELECT
    p.component, p.serves, p.cost_type, p.note,
    p.charges, p.spend_usd, p.spend_90d, p.first_charge, p.last_charge,
    -- No charge ever matched. Either the service is genuinely free at this tier,
    -- or the merchant string does not contain the pattern. Say so; do not let a
    -- zero read as a measured zero.
    p.charges = 0 AS no_charges_matched,
    CASE WHEN p.component = 'Claude API' THEN l.plm_llm_total END
        AS plm_attributed_usd,
    CASE WHEN p.component = 'Claude API' THEN l.plm_llm_90d END
        AS plm_attributed_90d,
    CASE WHEN p.component = 'Claude API' THEN l.llm_from END AS attributed_from,
    CASE WHEN p.component = 'Claude API' THEN l.llm_to   END AS attributed_to
FROM per_component p CROSS JOIN llm l
ORDER BY p.spend_usd DESC
