# f4-billing-postgres — Proposal

**Status:** Accepted  
**Author:** Phase 4 Team  
**Date:** 2026-07-17

## Why

Later Phase 4 billing and payment contracts need reliable, isolated persistence for billing
records and payment attempts. The Billing Service must own its database schema and health
behavior independently from other workshop services.

## What Changes

Add the Billing Service's own PostgreSQL persistence foundation: database configuration, initial billing-owned schema, migration runner, repository layer, readiness behavior, and tests.

This change only establishes durable storage owned by the Billing Service. It does not implement payment gateway integration, public billing CRUD endpoints, RabbitMQ consumers, compensation flows, or cross-service shared schemas.

## Scope

**In scope:**
- `DATABASE_URL` and database pool configuration for the Billing Service
- Initial PostgreSQL migration files owned by this service
- Billing-owned `billing_records` and `payment_attempts` tables needed by later payment contract work
- Repository layer for creating and reading billing records and recording payment-attempt state
- Migration command/runner for local and CI environments
- Readiness behavior that verifies PostgreSQL connectivity when configured
- Unit tests for configuration, readiness, and repository SQL behavior
- Documentation/evidence for validation commands

**Out of scope:**
- Payment gateway integration
- RabbitMQ/event consumer wiring and compensation
- Public HTTP billing CRUD endpoints
- Sharing schemas/models with other services
- Kubernetes manifests or provisioning external database infrastructure

## Decision

Use node-postgres (`pg`) for explicit connection pooling and parameterized SQL. Keep migrations as checked-in SQL files under `src/database/migrations/` and provide a small Bun-compatible runner that stores applied migrations in a service-local `schema_migrations` table.

## Risks

- A real PostgreSQL server is not available in all local/CI runs. Unit tests will mock the query boundary; integration testing with a live database remains a later environment concern.
