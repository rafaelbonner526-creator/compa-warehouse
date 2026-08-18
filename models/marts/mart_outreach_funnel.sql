SELECT COALESCE(angle,'unassigned') AS angle,
       COUNT(*) AS total_touches,
       SUM(is_open) AS opens,
       SUM(is_reply) AS replies,
       ROUND(SUM(is_open) * 100.00 / NULLIF(COUNT(*), 0),1) AS open_rate_pct,
       ROUND(SUM(is_reply) * 100.00 / NULLIF(COUNT(*), 0),1) AS reply_rate_pct,
       ROUND(SUM(is_reply) * 100.00 / NULLIF(SUM(is_open), 0),1) AS reply_over_open_rate_pct
FROM {{ ref('fact_touch')}}
GROUP BY angle
ORDER BY total_touches DESC