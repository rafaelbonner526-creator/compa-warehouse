-- What PLM has earned and what it has cost, all time.
--
-- REVENUE COMES FROM TWO PLACES AND ONLY ONE IS AUTOMATIC.
--   Stripe      the $50/mo retainer, ingested and self-updating.
--   Upwork      the build contract. NOT auto-detectable: the $1,530 ACH landed
--               on 2026-06-16 under the merchant "Citizens", the bank's own name,
--               indistinguishable from any other transfer without knowing the
--               amount and date in advance. It is therefore recorded by hand in
--               seeds/plm_revenue_events.csv and flagged `manual`, rather than
--               inferred by a merchant rule that would break the moment another
--               transfer of the same size arrived.
--
-- COSTS ARE CHARGED MONEY, with one deliberate substitution. Every component
-- marked serves='plm' contributes its actual card charges. Claude is marked
-- 'mixed' and is NOT counted at its card total, because roughly 96% of that bill
-- is Claude Code and personal use; PLM's share comes from Langfuse instead.
-- Counting the card total would show PLM costing about $104/mo against a $50/mo
-- retainer and make a profitable product look like a loss.
--
-- Railway and Supabase contribute nothing and that is CORRECT, not a gap: Rafa
-- confirmed 2026-09-03 that Supabase is on the free tier and Railway was charged
-- once in May and behaves like a drawn-down credit.
WITH manual_rev AS (
    SELECT
        COALESCE(SUM(net_usd), 0)  AS net_usd,
        COALESCE(SUM(gross_usd), 0) AS gross_usd,
        COUNT(*) AS n_events
    FROM {{ ref('plm_revenue_events') }}
),
stripe_rev AS (
    SELECT COALESCE(net_collected, 0) AS net_collected
    FROM {{ ref('mart_revenue') }}
),
plm_costs AS (
    SELECT
        COALESCE(SUM(spend_usd), 0) AS charged_usd,
        COALESCE(SUM(spend_per_month), 0) AS monthly_run_rate
    FROM {{ ref('mart_component_spend') }}
    WHERE serves = 'plm'
),
llm_costs AS (
    SELECT COALESCE(SUM(total_cost_usd), 0) AS plm_llm_usd
    FROM {{ ref('stg_plm_llm_cost') }}
)
SELECT
    ROUND(m.net_usd + s.net_collected, 2)              AS revenue_all_time,
    ROUND(m.net_usd, 2)                                AS revenue_build_manual,
    ROUND(s.net_collected, 2)                          AS revenue_retainer_stripe,
    m.n_events                                         AS manual_revenue_events,
    ROUND(c.charged_usd + l.plm_llm_usd, 2)            AS cost_all_time,
    ROUND(c.charged_usd, 2)                            AS cost_services,
    ROUND(l.plm_llm_usd, 2)                            AS cost_llm_attributed,
    ROUND(c.monthly_run_rate, 2)                       AS cost_per_month,
    ROUND(m.net_usd + s.net_collected
          - c.charged_usd - l.plm_llm_usd, 2)          AS net_all_time,
    -- Months of runway the retainer buys against the current run rate. NULL when
    -- the run rate is zero rather than dividing by it.
    CASE WHEN c.monthly_run_rate > 0
         THEN ROUND(50.0 / c.monthly_run_rate, 2) END  AS retainer_covers_costs_ratio
FROM manual_rev m CROSS JOIN stripe_rev s CROSS JOIN plm_costs c CROSS JOIN llm_costs l
