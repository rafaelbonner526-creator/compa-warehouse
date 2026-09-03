-- PLM database catalog snapshots. Everything arrives from dlt as text.
SELECT
    {{ try_cast_null('captured_at', 'timestamp') }}      AS captured_at,
    {{ try_cast_null('db_size_bytes', 'numeric') }}      AS db_size_bytes,
    {{ try_cast_null('user_tables', 'integer') }}        AS user_tables,
    {{ try_cast_null('live_tuples', 'numeric') }}        AS live_tuples,
    {{ try_cast_null('dead_tuples', 'numeric') }}        AS dead_tuples,
    -- unused_indexes counts EVERY never-scanned index, including unique and
    -- primary-key indexes that exist to enforce integrity and must never be
    -- dropped for being unread. droppable_indexes is the number a human can act
    -- on. Reporting the first as the second overstated a 600 kB tidy-up as a 60%
    -- problem on 2026-09-03.
    {{ try_cast_null('unused_indexes', 'integer') }}     AS unused_indexes,
    {{ try_cast_null('droppable_indexes', 'integer') }}  AS droppable_indexes,
    {{ try_cast_null('droppable_index_bytes', 'numeric') }} AS droppable_index_bytes,
    {{ try_cast_null('stats_reset_at', 'timestamp') }}   AS stats_reset_at,
    {{ try_cast_null('total_indexes', 'integer') }}      AS total_indexes,
    {{ try_cast_null('index_size_bytes', 'numeric') }}   AS index_size_bytes,
    {{ try_cast_null('connections', 'integer') }}        AS connections,
    {{ try_cast_null('longest_query_seconds', 'numeric') }} AS longest_query_seconds
FROM {{ source('bronze', 'plm_db_health') }}
