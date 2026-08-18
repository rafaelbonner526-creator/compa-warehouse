SELECT touch_id,
       lead_id,
       touch_date,
       channel,
       angle,
       touch_number,
       reply_sentiment,
       objection_tag,
       CASE 
           WHEN replied THEN 1
           ELSE 0 
       END AS is_reply,
       CASE 
           WHEN opened THEN 1
           ELSE 0 
       END AS is_open
FROM {{ ref('stg_touches')}}
