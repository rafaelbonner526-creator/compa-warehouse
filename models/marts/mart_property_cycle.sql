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
--
-- TROUGH DETECTION, and why it changed twice:
--   v1 took the global minimum of NOMINAL Case-Shiller over a 20-year window. That
--      happened to land on 2012 only because the window started in 2006.
--   v2 extended the series to its full history (1987+) for percentile work, and the
--      global-minimum method immediately broke: nominal house prices essentially
--      only rise, so the cheapest month in the whole series became January 1987.
--      The dashboard then reported "year 39.3 of 18" and a cycle starting in 1987.
--   v3 (this) matches the method mart_property_cycle_intervals already used:
--      deflate by CPI and take the most recent LOCAL minimum with a full window on
--      both sides. Two methods for one concept is how they drift apart.
--
-- Real, not nominal: over 39 years inflation dwarfs the cycle, and a nominal series
-- in an inflationary era never makes a trough at all. Deflated US prices produce two
-- local minima, 1997-02 and 2012-02, and the later one agrees with the independent
-- JST annual dataset's US trough of 2012.
WITH hp AS (
    SELECT obs_date, value AS nominal
    FROM {{ ref('stg_fred') }}
    WHERE series = 'house_prices' AND value IS NOT NULL
),
cpi AS (
    SELECT obs_date, value AS cpi
    FROM {{ ref('stg_fred') }}
    WHERE series = 'cpi' AND value IS NOT NULL AND value > 0
),
real_hp AS (
    SELECT h.obs_date, h.nominal, h.nominal / c.cpi AS rhp
    FROM hp h JOIN cpi c ON h.obs_date = c.obs_date
),
bounds AS (SELECT min(obs_date) AS first_date, max(obs_date) AS last_date FROM real_hp),
-- +/- 60 months. A trough must be the cheapest real price within five years either
-- side, with a COMPLETE window on both sides (n = 121), so the ends of the series
-- can never masquerade as a cycle low.
windowed AS (
    SELECT
        obs_date, nominal, rhp,
        min(rhp) OVER (ORDER BY obs_date ROWS BETWEEN 60 PRECEDING AND 60 FOLLOWING) AS win_min,
        count(*) OVER (ORDER BY obs_date ROWS BETWEEN 60 PRECEDING AND 60 FOLLOWING) AS win_n
    FROM real_hp
),
troughs AS (
    SELECT obs_date, nominal, rhp
    FROM windowed
    WHERE rhp = win_min AND win_n = 121
),
trough AS (
    SELECT obs_date AS trough_date, nominal AS trough_value
    FROM troughs
    QUALIFY row_number() OVER (ORDER BY obs_date DESC) = 1
),
prior_trough AS (
    SELECT obs_date AS prior_trough_date
    FROM troughs
    QUALIFY row_number() OVER (ORDER BY obs_date DESC) = 2
),
peak_since AS (
    SELECT max(h.nominal) AS peak_value
    FROM real_hp h CROSS JOIN trough t
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
        pt.prior_trough_date,
        b.last_date,
        b.first_date,
        round({{ dbt.datediff('t.trough_date', 'b.last_date', 'day') }} / 365.25, 1) AS years_since_trough,
        round(100 * (p.peak_value - t.trough_value) / nullif(t.trough_value, 0), 1)  AS pct_off_trough,
        CASE
            WHEN pt.prior_trough_date IS NULL THEN NULL
            ELSE round({{ dbt.datediff('pt.prior_trough_date', 't.trough_date', 'day') }} / 365.25, 1)
        END AS last_us_interval_years
    FROM trough t
    CROSS JOIN bounds b
    CROSS JOIN peak_since p
    LEFT JOIN prior_trough pt ON true
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
