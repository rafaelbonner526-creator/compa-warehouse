{# Cast that returns NULL on bad input, portable across warehouses.

   DuckDB uses TRY_CAST; BigQuery uses SAFE_CAST; they are not
   interchangeable, and dbt's built-in safe_cast is a plain (erroring) cast on
   DuckDB. adapter.dispatch picks the right implementation per warehouse.

   Usage:  {{ try_cast_null('found_date', 'date') }}
#}

{% macro try_cast_null(col, type) %}
    {{ return(adapter.dispatch('try_cast_null', 'compa_warehouse')(col, type)) }}
{% endmacro %}

{% macro default__try_cast_null(col, type) %}
    try_cast({{ col }} as {{ type }})
{% endmacro %}

{% macro bigquery__try_cast_null(col, type) %}
    safe_cast({{ col }} as {{ type }})
{% endmacro %}
