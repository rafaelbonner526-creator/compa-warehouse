SELECT touch_id,
    CAST(lead_id AS int) AS lead_id,
    CAST(date AS DATE) AS touch_date,
    channel,
    TRY_CAST(touch_number AS int) AS touch_number,
    angle,
    subject_line,
    CASE
        WHEN LOWER(replied) = 'yes' THEN true
        WHEN LOWER(replied) = 'no' THEN false
        ELSE NULL
    END AS replied,
    reply_sentiment,
    objection_tag,
    notes,
    CASE
        WHEN LOWER(opened) = 'yes' THEN true
        WHEN LOWER(opened) = 'no' THEN false
        ELSE NULL
    END AS opened
FROM {{ source('bronze', 'touch_log') }}
