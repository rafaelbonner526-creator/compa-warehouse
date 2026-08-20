-- Ampwell revenue against the venture binary.
--
-- THE QUESTION THIS ANSWERS: 2-3 real-money custom clients beyond Sult,
-- warm-acquired, by 2027-02-10. Miss that and the premium-warm motion is wrong
-- and a real pivot review is due (decision logged 2026-08-10). Everything else on
-- this dashboard tracks personal money; this is the only panel pointed at the
-- thing that is actually the stated priority.
--
-- TEST ROWS ARE NEVER COUNTED AS REVENUE. A Stripe test key returns real-looking
-- objects with livemode=false, and the default sample data includes a $100 charge
-- from "Testing Blueprints". Counting that would put a fake number against a real
-- deadline. Test rows are counted separately so the UI can say plainly that it is
-- looking at test data, rather than showing zero and letting it read as failure.
WITH charges AS (
    SELECT * FROM {{ ref('stg_stripe_charges') }}
),
live AS (
    SELECT * FROM charges WHERE livemode AND paid AND status = 'succeeded'
),
totals AS (
    SELECT
        coalesce(sum(amount - coalesce(amount_refunded, 0)), 0) AS net_collected,
        count(*)                                                AS paid_charges,
        count(DISTINCT customer_id)                             AS paying_customers,
        min(created_date)                                       AS first_payment,
        max(created_date)                                       AS last_payment
    FROM live
),
last_90 AS (
    SELECT coalesce(sum(amount - coalesce(amount_refunded, 0)), 0) AS collected_90d
    FROM live
    WHERE created_date >= cast({{ dbt.dateadd('day', -90, today()) }} as date)
),
subs AS (
    SELECT
        -- `count(*) FILTER (WHERE ...)` is DuckDB/Postgres only; BigQuery has
        -- COUNTIF instead. A conditional SUM compiles identically on both.
        sum(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_subscriptions,
        count(*)                                           AS total_subscriptions
    FROM {{ ref('stg_stripe_subscriptions') }}
    WHERE livemode
),
testrows AS (
    SELECT
        count(*)                                       AS test_charges,
        coalesce(sum(amount), 0)                       AS test_amount
    FROM charges WHERE NOT livemode
),
target AS (
    -- Constants, sourced from the 2026-08-10 decision. Kept here with the
    -- reasoning rather than in the UI so the deadline cannot drift between them.
    SELECT
        cast('2027-02-10' as date) AS deadline,
        2                          AS clients_target_min,
        3                          AS clients_target_max
)
SELECT
    t.net_collected,
    t.paid_charges,
    t.paying_customers,
    t.first_payment,
    t.last_payment,
    l.collected_90d,
    s.active_subscriptions,
    s.total_subscriptions,
    tr.test_charges,
    tr.test_amount,
    g.deadline,
    g.clients_target_min,
    g.clients_target_max,
    {{ dbt.datediff(today(), 'g.deadline', 'day') }}                       AS days_to_deadline,
    round({{ dbt.datediff(today(), 'g.deadline', 'day') }} / 30.44, 1)     AS months_to_deadline,
    greatest(g.clients_target_min - t.paying_customers, 0)                 AS clients_still_needed,
    CASE
        WHEN tr.test_charges > 0 AND t.paid_charges = 0 THEN 'test_data_only'
        WHEN t.paying_customers >= g.clients_target_min THEN 'on_target'
        WHEN {{ dbt.datediff(today(), 'g.deadline', 'day') }} < 90 THEN 'at_risk'
        ELSE 'behind'
    END AS status
FROM totals t
CROSS JOIN last_90 l
CROSS JOIN subs s
CROSS JOIN testrows tr
CROSS JOIN target g
