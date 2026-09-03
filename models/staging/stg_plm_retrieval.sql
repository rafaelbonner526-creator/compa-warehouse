-- RAG eval runs over a fixed golden set of synthetic queries. No member data.
--
-- Blank-timestamp rows are excluded here as well as in the extract. The upstream
-- appender wrote literal empty rows for three months, and a row that charts as a
-- real reading at zero is worse than a missing one.
SELECT
    {{ try_cast_null('run_timestamp', 'timestamp') }}   AS run_at,
    {{ try_cast_null('recall_at_5', 'numeric') }}       AS recall_at_5,
    {{ try_cast_null('recall_at_10', 'numeric') }}      AS recall_at_10,
    {{ try_cast_null('mrr', 'numeric') }}               AS mrr,
    {{ try_cast_null('mean_similarity', 'numeric') }}   AS mean_similarity,
    {{ try_cast_null('mean_latency_ms', 'numeric') }}   AS mean_latency_ms,
    {{ try_cast_null('n_cases', 'integer') }}           AS n_cases
FROM {{ source('bronze', 'plm_retrieval_runs') }}
WHERE run_timestamp IS NOT NULL AND trim(run_timestamp) != ''
