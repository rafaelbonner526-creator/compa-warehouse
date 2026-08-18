{% macro today() %}{{ return(adapter.dispatch('today', 'compa_warehouse')()) }}{% endmacro %}
{% macro default__today() %}current_date{% endmacro %}
{% macro bigquery__today() %}current_date(){% endmacro %}
