# f4-billing-payment-contracts — Proposal

**Status:** Accepted  
**Author:** Phase 4 Team  
**Date:** 2026-07-19

## Why

Later saga integration needs stable Billing Service contracts to create billing records, quote payable totals, open gateway-agnostic payment attempts, and report payment status. These contracts must be owned by the Billing Service, backed by its PostgreSQL boundary, and safe for retrying callers before any gateway or RabbitMQ compensation work exists.

## What Changes

Add REST/API and internal repository contracts for:

- Creating or replaying billing records using an idempotency key and correlation id.
- Returning billing quotes for existing billing records.
- Creating payment attempts without binding to a specific gateway implementation.
- Reporting payment attempt status and deriving the billing record status from gateway-agnostic attempt states.
- Validating request and response shapes and documenting the contracts in OpenAPI.

## Scope

**In scope:**
- HTTP routes for billing records, quotes, payment attempts, and payment status reporting.
- Request validation for ids, money, currency, statuses, idempotency keys, correlation ids, and optional metadata.
- Repository methods and migrations limited to Billing-owned PostgreSQL tables.
- Idempotency/correlation fields needed for later saga orchestration.
- Unit tests for route contracts, validation, mappings, idempotency, and status transitions.
- OpenAPI and evidence documentation.

**Out of scope:**
- Payment gateway adapters, SDK calls, captures, refunds, or authorization flows.
- RabbitMQ consumers/producers and compensation workflow implementation.
- Sharing models or schema packages with other workshop services.
- Cross-service database access.

## Decision

Expose REST contracts from the Billing Service and keep gateway-specific data inside optional metadata/provider reference fields. Enforce retry safety with unique idempotency keys on billing records and payment attempts, store correlation ids on both tables, and map payment attempt terminal states to billing record status inside the repository/service boundary.

## Risks

- PostgreSQL schema changes are exercised through mocked query-boundary tests in this repository; live database integration depends on external environment provisioning.
- Future gateway integration may add provider-specific constraints, but this change intentionally keeps contracts gateway-agnostic.
