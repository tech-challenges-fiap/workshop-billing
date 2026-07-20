# billing-postgres Specification

## Purpose
Define the Billing Service-owned PostgreSQL persistence foundation, including configuration, migrations, repository boundaries, and readiness behavior for later Phase 4 billing/payment work.
## Requirements
### Requirement: Billing-owned PostgreSQL configuration

The Billing Service SHALL define its own PostgreSQL configuration and connection pool without depending on another workshop service database, schema, or model package.

#### Scenario: Database URL is configured

- **GIVEN** `DATABASE_URL` is provided in the process environment
- **WHEN** the service creates its database configuration
- **THEN** it uses that URL for Billing Service persistence
- **AND** it does not read database settings from another service namespace

#### Scenario: Database URL is missing

- **GIVEN** `DATABASE_URL` is absent
- **WHEN** readiness is evaluated
- **THEN** the service reports not ready with HTTP 503
- **AND** the response explains that the database is not configured

### Requirement: Billing-owned PostgreSQL schema migrations

The Billing Service SHALL include repeatable migration assets for the initial billing-owned PostgreSQL schema.

#### Scenario: Initial migration defines billing tables

- **GIVEN** a developer inspects the migration files
- **WHEN** the initial PostgreSQL migration is opened
- **THEN** it defines Billing Service owned tables for `billing_records` and `payment_attempts`
- **AND** it defines migration bookkeeping needed by the service-local runner
- **AND** it does not create objects in schemas owned by other services

#### Scenario: Migration runner applies pending migrations

- **GIVEN** a PostgreSQL database reachable through `DATABASE_URL`
- **WHEN** the migration command is executed
- **THEN** pending migration files are applied in filename order inside transactions
- **AND** applied migration filenames are recorded so repeated runs are safe

### Requirement: Billing repository layer

The Billing Service SHALL provide a repository layer for the initial billing-owned tables needed by later payment contracts.

#### Scenario: Billing record is persisted

- **GIVEN** a billing record draft with order, customer, amount, and currency
- **WHEN** the repository creates the record
- **THEN** it writes a parameterized insert to `billing_records`
- **AND** it returns the persisted billing record fields without exposing database-driver rows directly

#### Scenario: Payment attempt is recorded

- **GIVEN** an existing billing record and a payment-attempt draft
- **WHEN** the repository records the payment attempt
- **THEN** it writes a parameterized insert to `payment_attempts`
- **AND** it stores gateway-agnostic status and optional metadata for later payment processing work

### Requirement: PostgreSQL readiness behavior

The Billing Service readiness endpoint SHALL include PostgreSQL connectivity in its readiness decision.

#### Scenario: Database connectivity succeeds

- **GIVEN** the service has a configured database checker
- **WHEN** a client calls `GET /ready` and the checker succeeds
- **THEN** the response status is HTTP 200
- **AND** the response includes database status `ok`

#### Scenario: Database connectivity fails

- **GIVEN** the service has a configured database checker
- **WHEN** a client calls `GET /ready` and the checker fails
- **THEN** the response status is HTTP 503
- **AND** the response includes database status `unavailable`

