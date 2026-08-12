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

    -- dates (try_cast: blanks/bad values become NULL instead of erroring)
    TRY_CAST(found_date AS DATE)      AS found_date,
    TRY_CAST(last_touch_date AS DATE) AS last_touch_date,
    TRY_CAST(next_action_date AS DATE) AS next_action_date

FROM {{ source('bronze', 'leads_master') }}





