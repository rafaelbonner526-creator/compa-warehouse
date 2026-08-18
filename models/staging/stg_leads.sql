SELECT CAST(id AS int) AS lead_id,
    name,
    practice_name,
    specialty,

    -- location
    city,
    state,

    -- contact
    website,
    lower(trim(email))                AS email,
    linkedin_url,
    community_platform,

    -- funnel state + segmentation
    status,
    source,
    angle_assigned,
    cohort,
    segment,
    contact_type,

    -- lead research (the value; kept as-is)
    content_signals,
    audience_size_estimate,           -- free text ('65K IG','large') -> do NOT cast
    notes,

    -- flags (Y/N -> real boolean)
    has_team = 'Y'                    AS has_team,
    operator_visible = 'Y'            AS operator_visible,
    email_list,                       -- dirty ('Y','N','personal') -> keep text for now
    CASE
        WHEN lower(linkedin_active) in ('true','yes') THEN true
        WHEN lower(linkedin_active) = 'false'         THEN false
        ELSE NULL
    END                               AS linkedin_active,

    -- dates (safe_cast: blanks/bad values become NULL instead of erroring;
    -- dbt.safe_cast compiles to TRY_CAST on duckdb, SAFE_CAST on bigquery)
    {{ try_cast_null('found_date', 'date') }}       AS found_date,
    {{ try_cast_null('last_touch_date', 'date') }}  AS last_touch_date,
    {{ try_cast_null('next_action_date', 'date') }} AS next_action_date

FROM {{ source('bronze', 'leads_master') }}





