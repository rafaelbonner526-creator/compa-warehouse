# 09 - Finance domain: Monarch to bronze (Engine A)

**Session 8** - 2026-08-18

Second data domain (budget), same medallion pattern, new source: Monarch.

- **Two-stage extract/load** (venv boundary): `extract_monarch.py` (monarch-mcp venv, keychain auth, read-only) pulls accounts, categories, recurring, and ~13 months of transactions to JSON landing files; `load_finance.py` (dlt, dual-target) flattens nested dicts and loads to bronze.
- **Bronze tables**: `mm_accounts` (12), `mm_categories` (63), `mm_recurring` (14), `mm_transactions` (1718).
- Nested dicts flattened (`category__name`, `account__display_name`, `merchant__name`); list fields (tags, attachments) dropped to avoid dlt child tables.
- Shared `_destination.py` so every loader lands in the same warehouse.

Next: silver staging + gold marts (safe-to-spend rolling 30d, groceries = flexible) + Budget dashboard view with forecasting.
