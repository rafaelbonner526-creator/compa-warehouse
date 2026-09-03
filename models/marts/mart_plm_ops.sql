-- PLM operational health, measured rather than asserted.
--
-- SCOPE IS DELIBERATE AND NARROW: catalog aggregates and RAG eval metrics only.
-- No patient data reaches this warehouse. assessment_jobs and
-- assessment_attempts carry email, full_name, payload, responses, ai_results and
-- domain_scores, and with 13 members even a de-identified completion date can
-- re-identify. Anything patient-derived must be aggregated inside Postgres and
-- exported as an aggregate, never as rows.
--
-- RETRIEVAL METRICS ARE A REGRESSION CHECK, NOT A TREND. recall@5 measured
-- 0.9529411764705882 on 2026-05-27, twice on 2026-08-27 and again on 2026-09-03:
-- identical to sixteen decimal places across 99 days and a retrieval refactor.
-- Embeddings are deterministic and neither the knowledge base nor the golden set
-- changed, so runs cannot produce a distribution. `runs_at_current_value` is
-- therefore the honest statistic, not a moving average. The gate that enforces it
-- lives in PLM (scripts/lint_retrieval_regression.py, invariant I8); this model
-- reports, it does not enforce.
--
-- LATENCY IS THE OPPOSITE and is the retrieval number actually worth watching:
-- 217ms to 3561ms across twenty cases in a single run.
WITH health AS (
    SELECT * FROM {{ ref('stg_plm_db_health') }}
),
latest_health AS (
    SELECT * FROM health ORDER BY captured_at DESC LIMIT 1
),
retrieval AS (
    SELECT * FROM {{ ref('stg_plm_retrieval') }} WHERE recall_at_5 IS NOT NULL
),
latest_retrieval AS (
    SELECT * FROM retrieval ORDER BY run_at DESC LIMIT 1
),
stable AS (
    -- How many consecutive recent runs sit at the current value. With a
    -- deterministic measure this is the meaningful stability statistic.
    SELECT COUNT(*) AS runs_at_current_value
    FROM retrieval r
    CROSS JOIN latest_retrieval l
    WHERE ABS(r.recall_at_5 - l.recall_at_5) < 0.0001
)
SELECT
    'database' AS area,
    lh.captured_at                                   AS measured_at,
    ROUND(lh.db_size_bytes / 1000000.0, 1)           AS db_size_mb,
    lh.user_tables,
    lh.connections,
    lh.total_indexes,
    lh.unused_indexes,
    -- The headline maintenance signal. Every never-scanned index still costs
    -- write throughput and storage on each insert and update.
    ROUND(100.0 * lh.unused_indexes / NULLIF(lh.total_indexes, 0), 0)
        AS unused_index_pct,
    -- Autovacuum conventionally triggers around 20% dead tuples, so this is the
    -- number to read against that, not the raw count.
    ROUND(100.0 * lh.dead_tuples / NULLIF(lh.live_tuples + lh.dead_tuples, 0), 1)
        AS dead_tuple_pct,
    lh.longest_query_seconds,
    CAST(NULL AS {{ dbt.type_numeric() }}) AS recall_at_5,
    CAST(NULL AS {{ dbt.type_numeric() }}) AS mrr,
    CAST(NULL AS {{ dbt.type_numeric() }}) AS mean_latency_ms,
    CAST(NULL AS {{ dbt.type_int() }})     AS runs_at_current_value,
    CAST(NULL AS {{ dbt.type_int() }})     AS n_cases
FROM latest_health lh

UNION ALL

SELECT
    'retrieval' AS area,
    lr.run_at                              AS measured_at,
    CAST(NULL AS {{ dbt.type_numeric() }}) AS db_size_mb,
    CAST(NULL AS {{ dbt.type_int() }})     AS user_tables,
    CAST(NULL AS {{ dbt.type_int() }})     AS connections,
    CAST(NULL AS {{ dbt.type_int() }})     AS total_indexes,
    CAST(NULL AS {{ dbt.type_int() }})     AS unused_indexes,
    CAST(NULL AS {{ dbt.type_numeric() }}) AS unused_index_pct,
    CAST(NULL AS {{ dbt.type_numeric() }}) AS dead_tuple_pct,
    CAST(NULL AS {{ dbt.type_numeric() }}) AS longest_query_seconds,
    lr.recall_at_5,
    lr.mrr,
    lr.mean_latency_ms,
    s.runs_at_current_value,
    lr.n_cases
FROM latest_retrieval lr CROSS JOIN stable s
