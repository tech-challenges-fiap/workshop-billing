# f4-billing-postgres — Design Notes

## Ownership boundary

The Billing Service owns its PostgreSQL schema. Tables and TypeScript types are duplicated locally and are not imported from other workshop services.

## Configuration

- `DATABASE_URL` identifies the Billing Service database.
- `DATABASE_POOL_MAX` optionally tunes the connection pool and defaults to a small local-development value.
- Missing `DATABASE_URL` is tolerated for liveness and unit-test contexts, but readiness reports `503` because the service cannot accept persisted billing work without its database.

## Schema

Initial tables are intentionally limited to persistence needed by later payment contracts:

- `billing_records`: durable billing aggregate keyed by an internal UUID and unique `order_id`.
- `payment_attempts`: gateway-agnostic attempt history linked to `billing_records`.
- `schema_migrations`: migration bookkeeping for the local runner.

Status values remain generic (`pending`, `processing`, `paid`, `failed`, `canceled`) to avoid implementing payment gateway semantics in this change.

## Repository layer

Repositories receive a minimal `Queryable` interface with parameterized SQL. This keeps production code backed by `pg.Pool` while tests can assert SQL and parameter behavior without a live database.

## Readiness

`GET /health` remains a process liveness probe. `GET /ready` checks PostgreSQL connectivity through `SELECT 1` when a database pool is configured and returns `503` with an explicit reason if the database is unavailable or unconfigured.

## Migrations

SQL migration files live in `src/database/migrations/` and are applied by `src/database/migrate.ts`. The runner executes pending migrations inside transactions and records the filename after success.
