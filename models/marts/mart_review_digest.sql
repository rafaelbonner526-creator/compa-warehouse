-- The periodic review, assembled.
--
-- WHY THIS EXISTS: the governance stack says look quarterly, and the research
-- behind it says looking more often lowers returns. That creates a real problem
-- for a dashboard, because the thing designed to be ignored is also the thing
-- that has to be opened to work. Alerts are the wrong fix: they are a machine for
-- making you check constantly, which is the behaviour being guarded against.
--
-- A digest on the cadence the framework ALREADY prescribes is the right fix. The
-- evidence that this was missing: the thesis says the quarterly rebalance was due
-- around 2026-08-07, and nothing surfaced it while five portfolio actions sat open.
--
-- Row-based and heterogeneous on purpose, so the web page and the plain-text
-- script render the same content without either one re-deriving it.
--
-- severity: 1 act now, 2 handle at the review, 3 context.
WITH cadence AS (
    SELECT
        review,
        what_to_do,
        {{ try_cast_null('cadence_days', 'integer') }}   AS cadence_days,
        {{ try_cast_null('last_completed', 'date') }}    AS last_completed
    FROM {{ ref('review_cadence') }}
),
cadence_rows AS (
    SELECT
        'Cadence' AS section,
        1 AS ord,
        CASE
            WHEN {{ dbt.datediff('last_completed', today(), 'day') }} > cadence_days
            THEN review || ' is OVERDUE'
            ELSE review || ' due in '
                 || cast(cadence_days - {{ dbt.datediff('last_completed', today(), 'day') }} as {{ dbt.type_string() }})
                 || ' days'
        END AS headline,
        what_to_do AS detail,
        -- "-260 days past due" is not a thing anyone says
        CASE
            WHEN {{ dbt.datediff('last_completed', today(), 'day') }} > cadence_days
            THEN cast({{ dbt.datediff('last_completed', today(), 'day') }} - cadence_days as {{ dbt.type_string() }}) || ' days past due'
            ELSE 'on schedule'
        END AS value,
        CASE WHEN {{ dbt.datediff('last_completed', today(), 'day') }} > cadence_days THEN 1 ELSE 3 END AS severity
    FROM cadence
),
action_rows AS (
    SELECT
        'Portfolio' AS section,
        2 AS ord,
        title AS headline,
        detail,
        CASE WHEN unit = '$'
             THEN '$' || cast(cast(round(current_value) as integer) as {{ dbt.type_string() }})
             ELSE cast(current_value as {{ dbt.type_string() }}) || unit END AS value,
        severity
    FROM {{ ref('mart_portfolio_actions') }}
    WHERE status = 'act'
),
budget_rows AS (
    SELECT
        'Budget' AS section,
        3 AS ord,
        category_group || ' is running ' || cast(cast(gap_vs_target as integer) as {{ dbt.type_string() }})
            || '/mo over a ' || cast(cast(target_trailing as integer) as {{ dbt.type_string() }}) || ' target' AS headline,
        coalesce(note, '') AS detail,
        '$' || cast(cast(avg_3mo as integer) as {{ dbt.type_string() }}) || '/mo actual' AS value,
        CASE WHEN status = 'well_over' THEN 2 ELSE 3 END AS severity
    FROM {{ ref('mart_budget_vs_actual') }}
    WHERE gap_vs_target > 50
),
revenue_rows AS (
    SELECT
        'Revenue' AS section,
        4 AS ord,
        cast(paying_customers as {{ dbt.type_string() }}) || ' of '
            || cast(clients_target_min as {{ dbt.type_string() }})
            || ' paying clients, ' || cast(months_to_deadline as {{ dbt.type_string() }})
            || ' months to the binary' AS headline,
        'Miss it and the premium-warm motion is wrong, which triggers a pivot review rather than more volume.' AS detail,
        '$' || cast(cast(net_collected as integer) as {{ dbt.type_string() }}) || ' collected' AS value,
        CASE WHEN status = 'on_target' THEN 3 ELSE 2 END AS severity
    FROM {{ ref('mart_revenue') }}
),
data_rows AS (
    SELECT
        'Data' AS section,
        5 AS ord,
        source || ' has not published in ' || cast(data_age_days as {{ dbt.type_string() }}) || ' days' AS headline,
        feeds AS detail,
        'through ' || cast(data_through as {{ dbt.type_string() }}) AS value,
        3 AS severity
    FROM {{ ref('mart_data_freshness') }}
    WHERE status = 'stale'
)
SELECT * FROM cadence_rows
UNION ALL SELECT * FROM action_rows
UNION ALL SELECT * FROM budget_rows
UNION ALL SELECT * FROM revenue_rows
UNION ALL SELECT * FROM data_rows
ORDER BY severity, ord, headline
