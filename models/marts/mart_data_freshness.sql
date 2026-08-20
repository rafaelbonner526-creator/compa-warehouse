-- Per-source freshness: when we last PULLED, and how recent the newest
-- observation actually is. Those are different things and conflating them is the
-- specific confusion this model exists to kill.
--
-- The Market tab shows a CAPE reading from 2024-09, a credit ratio from 2020, and
-- a Fed funds rate from today, side by side, distinguished only by small print. A
-- number can also be freshly loaded and still be years old: the JST pipeline ran
-- this morning and its newest row is still 2020, because that is when the dataset
-- ends. Both facts have to be visible or the reader assumes everything is current.
--
-- Two columns, deliberately:
--   last_loaded   when the pipeline last ran (are we still pulling?)
--   data_through  the newest observation in the table (how old is the newest fact?)
--
-- expected_lag_days is the point past which the data SHOULD have moved. It is not
-- a guess: it comes from the publication cadence of each source (daily market
-- series, monthly CPI-style releases, quarterly national accounts, annual research
-- datasets) plus that source's own publication delay.
-- dlt pipeline names are target-specific by design (compa_macro_duckdb vs
-- compa_macro_bigquery) to stop dev and prod sharing load state. Matching them
-- exactly therefore resolves on one target and silently returns NULL on the other,
-- which is how "last pulled" rendered as a column of dashes in prod.
WITH loads AS (
    SELECT
        CASE
            WHEN schema_name LIKE 'compa_macro%'       THEN 'macro'
            WHEN schema_name LIKE 'compa_longhistory%' THEN 'longhistory'
            WHEN schema_name LIKE 'compa_finance%'     THEN 'finance'
            ELSE 'bronze'
        END AS pipeline_key,
        max(inserted_at) AS last_loaded
    FROM {{ source('bronze', '_dlt_loads') }}
    GROUP BY 1
),
src AS (
    SELECT 'Monarch transactions' AS source, 1 AS ord, 'finance' AS pipeline,
           max(txn_date) AS data_through, 3 AS expected_lag_days,
           'Spending, income, categories. Everything on the Budget tab.' AS feeds
    FROM {{ ref('stg_transactions') }}
    UNION ALL
    SELECT 'FRED macro (fastest series)', 2, 'macro',
           max(obs_date), 5,
           'Regime, equilibriums, rates, the news climate.'
    FROM {{ ref('stg_fred') }}
    WHERE series IN ('fed_funds', 'bond_10y', 'vix', 'dollar_index')
    UNION ALL
    SELECT 'FRED macro (slowest series)', 3, 'macro',
           min(latest), 120,
           'Debt/GDP and foreign Treasury holdings are quarterly, so they lag by design.'
    FROM (
        SELECT series, max(obs_date) AS latest
        FROM {{ ref('stg_fred') }}
        WHERE series IN ('debt_to_gdp', 'foreign_treasury', 'capacity_utilization')
        GROUP BY series
    ) q
    UNION ALL
    -- max(year) and max(period) must come from the SAME row. Taking them
    -- independently produced 2024-12 for a series whose last observation is
    -- 2024-09, because some earlier year had a December reading.
    SELECT 'Shiller CAPE', 4, 'longhistory',
           (SELECT cast(cast(year as {{ dbt.type_string() }}) || '-' || lpad(cast(period as {{ dbt.type_string() }}), 2, '0') || '-01' as date)
            FROM {{ ref('stg_lh_shiller') }}
            WHERE series = 'cape'
            ORDER BY year DESC, period DESC
            LIMIT 1),
           400,
           'Valuation percentile over 144 years. Revised roughly annually.'
    FROM (SELECT 1) x
    UNION ALL
    SELECT 'JST macrohistory', 5, 'longhistory',
           cast(cast(max(year) as {{ dbt.type_string() }}) || '-12-31' as date), 800,
           'Credit and public debt context, and the 18-year cycle test. Dataset ends where it ends.'
    FROM {{ ref('stg_lh_jst') }}
    UNION ALL
    SELECT 'Bank of England millennium', 6, 'longhistory',
           cast(cast(max(year) as {{ dbt.type_string() }}) || '-12-31' as date), 1200,
           'Reference only. Not currently driving any panel.'
    FROM {{ ref('stg_lh_boe') }}
    UNION ALL
    SELECT 'SIGNAL leads', 7, 'bronze',
           max(txn_date), 30, 'Outreach funnel.'
    FROM (SELECT cast(max(found_date) as date) AS txn_date FROM {{ ref('stg_leads') }}) l
)
SELECT
    src.source,
    src.ord,
    src.feeds,
    src.data_through,
    l.last_loaded,
    src.expected_lag_days,
    {{ dbt.datediff('src.data_through', today(), 'day') }} AS data_age_days,
    CASE
        WHEN src.data_through IS NULL THEN 'unknown'
        WHEN {{ dbt.datediff('src.data_through', today(), 'day') }} <= src.expected_lag_days THEN 'current'
        WHEN {{ dbt.datediff('src.data_through', today(), 'day') }} <= src.expected_lag_days * 2 THEN 'lagging'
        ELSE 'stale'
    END AS status
FROM src
LEFT JOIN loads l ON l.pipeline_key = src.pipeline
ORDER BY src.ord
