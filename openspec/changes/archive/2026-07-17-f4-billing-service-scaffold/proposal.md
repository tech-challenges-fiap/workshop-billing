# f4-billing-service-scaffold — Proposal

**Status:** Accepted  
**Author:** Phase 4 Team  
**Date:** 2026-07-15

## Summary

Create the initial scaffold for the `workshop-billing` microservice: repository baseline, health/readiness endpoints, Dockerfile, lint/test/build toolchain, OpenAPI placeholder, and CI expectations.

No payment domain logic is included in this change.

## Motivation

Phase 4 requires a dedicated Billing Service isolated from the other workshop microservices. This scaffold establishes the repository conventions and operational foundations that all future billing features will build upon.

## Scope

**In scope:**
- Repository baseline (README, AGENTS, package.json, tsconfig, biome)
- Minimal Hono application with `GET /health` and `GET /ready`
- Dockerfile (multi-stage, Bun-based)
- Biome lint configuration
- Test skeleton with ≥ 80% coverage target
- OpenAPI 3.1 placeholder (health + ready endpoints only)
- CI pipeline expectations documented

**Out of scope:**
- Payment gateway integration
- Billing record CRUD
- Invoice generation
- Event consumer wiring
- Database setup

## Decision

Proceed with Bun + Hono + TypeScript, consistent with existing workshop service conventions. Biome replaces ESLint/Prettier for a single-tool experience. Tests co-located with source files.

## Risks

- None significant for a scaffold-only change.
