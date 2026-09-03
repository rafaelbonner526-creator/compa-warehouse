-- Where Rafa actually stands against an outside reference, with the rate of change.
--
-- WHY: every target in this warehouse until now was SELF-SET -- his own budget
-- targets, his own allocation bands, his own venture deadline. Self-set targets
-- answer "am I doing what I said" and cannot answer "is what I said any good".
-- This model answers the second question against published outside data.
--
-- LEVEL AND RATE OF CHANGE TOGETHER, never a bare level. A net worth figure on
-- its own says nothing about whether it is going anywhere; the pairing is the
-- whole point (Dalio, and the communication rules in COMPA).
--
-- COMPARABILITY IS A COLUMN, NOT A FOOTNOTE. The baselines are not equally
-- trustworthy and pretending otherwise would defeat the purpose:
--   direct      Federal Reserve SCF, Google SRE. Authoritative, unbiased.
--   indicative  consulting-rate guides. VENDOR-BIASED: they sell to consultants
--               and quote aspirational rates. Directionally useful, not a target.
--   none        no credible external baseline exists. Say so; do not invent one.
-- A consumer that renders an 'indicative' row identically to a 'direct' one is
-- lying by omission, so both the dashboard and the brief must show this.
WITH base AS (
    SELECT * FROM {{ ref('baselines') }}
    WHERE value IS NOT NULL
),
-- Current value and a prior value for each metric we can actually measure.
-- Anything without an actual is still emitted, so a baseline with no
-- measurement shows as UNKNOWN rather than silently vanishing.
nw AS (
    SELECT
        (SELECT net_worth FROM {{ ref('mart_networth') }}
          ORDER BY snapshot_date DESC LIMIT 1)                    AS current_value,
        (SELECT net_worth FROM {{ ref('mart_networth') }}
          WHERE snapshot_date <= {{ dbt.dateadd('day', -90, 'current_date()') }}
          ORDER BY snapshot_date DESC LIMIT 1)                    AS prior_value,
        (SELECT max(snapshot_date) FROM {{ ref('mart_networth') }}) AS as_of
),
rev AS (
    SELECT
        -- The retainer, not the charge: the Stripe amount includes automatic
        -- tax, and comparing a tax-inclusive charge to a quoted retainer band
        -- would overstate the position.
        50.0 AS current_value,
        CAST(NULL AS {{ dbt.type_float() }}) AS prior_value,
        (SELECT last_payment FROM {{ ref('mart_revenue') }}) AS as_of
),
actuals AS (
              SELECT 'net_worth'        AS metric_key, current_value, prior_value, as_of FROM nw
    UNION ALL SELECT 'monthly_retainer', current_value, prior_value, as_of FROM rev
),
joined AS (
    SELECT
        b.domain, b.metric_key, b.tier, b.value AS baseline_value, b.unit,
        b.population, b.source_name, b.source_url, b.as_of_year,
        b.comparability, b.caution,
        a.current_value, a.prior_value, a.as_of AS measured_on
    FROM base b
    LEFT JOIN actuals a ON a.metric_key = b.metric_key
)
SELECT
    domain, metric_key, tier, baseline_value, unit, population,
    source_name, source_url, as_of_year, comparability, caution,
    current_value, measured_on,
    CASE WHEN current_value IS NULL THEN NULL
         ELSE ROUND(CAST(current_value - baseline_value AS {{ dbt.type_numeric() }}), 2)
    END AS gap_to_tier,
    CASE WHEN current_value IS NULL THEN 'unknown'
         WHEN current_value >= baseline_value THEN 'at or above'
         ELSE 'below'
    END AS standing,
    -- Rate of change over the trailing window, so a level is never reported
    -- alone. NULL when there is no prior reading: unknown is not zero.
    prior_value,
    CASE WHEN current_value IS NULL OR prior_value IS NULL THEN NULL
         ELSE ROUND(CAST(current_value - prior_value AS {{ dbt.type_numeric() }}), 2)
    END AS change_90d,
    CASE WHEN current_value IS NULL OR prior_value IS NULL OR prior_value = 0 THEN NULL
         ELSE ROUND(CAST(100.0 * (current_value - prior_value) / prior_value AS {{ dbt.type_numeric() }}), 1)
    END AS change_90d_pct
FROM joined
ORDER BY domain, metric_key, baseline_value
