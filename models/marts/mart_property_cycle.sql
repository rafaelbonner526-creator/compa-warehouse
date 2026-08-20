-- Property-cycle position, with the cycle length MEASURED rather than assumed.
--
-- ATTRIBUTION: the 18-year property cycle is Fred Harrison and Phil Anderson,
-- building on Homer Hoyt's land-value work. It is NOT a Warren Buffett model,
-- which it is frequently miscredited as.
--
-- WHAT CHANGED AND WHY: this model previously hardcoded an 18-year cycle and
-- reported a position to one decimal place ("year 14.2 of 18, 78.9% complete"),
-- derived from a 39-year Case-Shiller window containing a single trough. One
-- trough cannot support a claim about periodicity, and the decimal place implied
-- precision the evidence could not carry.
--
-- The length now comes from mart_property_cycle_intervals: 83 measured
-- trough-to-trough intervals across 18 countries, 1870-2020. The measurement is
-- genuinely kind to the model on average and brutal on its precision, and the
-- dashboard reports both halves of that.
--
-- Current position still comes from Case-Shiller, because JST ends in 2020 and the
-- question is where we are NOW. The two agree where they overlap: JST's last
-- measured US real-price trough is 2012, the same year this model finds in
-- nominal Case-Shiller.
WITH hp AS (
    SELECT obs_date, value
    FROM {{ ref('stg_fred') }}
    WHERE series = 'house_prices' AND value IS NOT NULL
),
bounds AS (SELECT min(obs_date) AS first_date, max(obs_date) AS last_date FROM hp),
trough AS (
    SELECT obs_date AS trough_date, value AS trough_value
    FROM hp
    QUALIFY row_number() OVER (ORDER BY value ASC, obs_date ASC) = 1
),
peak_since AS (
    SELECT max(h.value) AS peak_value
    FROM hp h CROSS JOIN trough t
    WHERE h.obs_date >= t.trough_date
),
-- measured distribution, all countries.
-- Quantiles are computed with percent_rank() rather than median() or
-- percentile_cont(..) WITHIN GROUP: DuckDB and BigQuery disagree on both of those,
-- and this dual-target project has to compile identically on each.
ranked_iv AS (
    SELECT
        interval_years AS v,
        percent_rank() OVER (ORDER BY interval_years) AS pr
    FROM {{ ref('mart_property_cycle_intervals') }}
    WHERE interval_years IS NOT NULL
),
dist AS (
    SELECT
        count(*)                                    AS n_intervals,
        round(avg(v), 1)                            AS measured_mean,
        round(stddev(v), 1)                         AS measured_sd,
        min(v)                                      AS measured_min,
        max(v)                                      AS measured_max,
        min(CASE WHEN pr >= 0.50 THEN v END)        AS measured_median,
        min(CASE WHEN pr >= 0.25 THEN v END)        AS measured_p25,
        min(CASE WHEN pr >= 0.75 THEN v END)        AS measured_p75,
        -- how often the model's own 18-year claim actually lands, +/- 2 years
        round(100.0 * sum(CASE WHEN v BETWEEN 16 AND 20 THEN 1 ELSE 0 END) / count(*), 0) AS pct_within_16_20
    FROM ranked_iv
),
countries AS (
    SELECT count(DISTINCT entity) AS n_countries
    FROM {{ ref('mart_property_cycle_intervals') }}
    WHERE interval_years IS NOT NULL
),
-- the US on its own, which is the least regular country in the sample
usa AS (
    SELECT
        count(*)                       AS usa_n_intervals,
        round(avg(interval_years), 1)  AS usa_mean,
        min(interval_years)            AS usa_min,
        max(interval_years)            AS usa_max
    FROM {{ ref('mart_property_cycle_intervals') }}
    WHERE interval_years IS NOT NULL AND entity = 'USA'
),
pos AS (
    SELECT
        t.trough_date,
        b.last_date,
        b.first_date,
        round({{ dbt.datediff('t.trough_date', 'b.last_date', 'day') }} / 365.25, 1) AS years_since_trough,
        round(100 * (p.peak_value - t.trough_value) / nullif(t.trough_value, 0), 1)  AS pct_off_trough,
        t.trough_date = b.first_date                                                 AS trough_at_edge
    FROM trough t CROSS JOIN bounds b CROSS JOIN peak_since p
)
SELECT
    pos.*,
    dist.*,
    countries.*,
    usa.*,
    -- The model's own number, kept because the phase structure below is defined
    -- against it. It is a MODEL parameter, not a measurement.
    18.0 AS model_cycle_years,
    round(100 * pos.years_since_trough / 18.0, 1) AS cycle_pct_complete,
    CASE
        WHEN pos.years_since_trough IS NULL THEN 'unknown'
        WHEN pos.years_since_trough <  7.0  THEN 'Recovery'
        WHEN pos.years_since_trough <  9.0  THEN 'Mid-cycle slowdown'
        WHEN pos.years_since_trough < 14.0  THEN 'Expansion'
        WHEN pos.years_since_trough < 16.0  THEN 'Mania / peak'
        WHEN pos.years_since_trough < 18.0  THEN 'Downturn'
        ELSE 'Past model horizon (new cycle unconfirmed)'
    END AS phase,
    -- Plausible window for the next low, from the measured quartiles rather than
    -- the model's single number.
    cast(extract(year from pos.trough_date) + dist.measured_p25 as integer) AS next_low_earliest,
    cast(extract(year from pos.trough_date) + dist.measured_p75 as integer) AS next_low_latest
FROM pos CROSS JOIN dist CROSS JOIN countries CROSS JOIN usa
