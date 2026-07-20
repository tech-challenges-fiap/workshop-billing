# f4-billing-postgres — Tasks

Tracks implementation work for the Billing Service PostgreSQL persistence foundation.

## OpenSpec tasks

- [x] Create proposal, design notes, task list, and spec deltas
- [x] Validate OpenSpec change with `npx --yes @fission-ai/openspec validate f4-billing-postgres --strict` before implementation

## Persistence tasks

- [x] Add PostgreSQL dependencies and scripts
- [x] Add database environment configuration and pool factory
- [x] Add service-owned SQL migrations and migration runner
- [x] Add repository layer for billing records and payment attempts
- [x] Update readiness behavior to check PostgreSQL connectivity when configured
- [x] Document database setup and commands

## Tests and validation

- [x] Add unit tests for env/config behavior
- [x] Add unit tests for repository SQL behavior
- [x] Add unit tests for readiness DB behavior
- [x] Run `bun run lint`
- [x] Run `bun run typecheck`
- [x] Run `bun run test`
- [x] Run `bun run test:coverage`
- [x] Run `bun run build`
- [x] Re-run OpenSpec strict validation

## Evidence and archive

- [x] Create `docs/evidence/fase-4/f4-billing-postgres.md`
- [x] Archive OpenSpec change after all validation passes
- [x] Validate specs after archive
