# Evidence — f4-billing-postgres

## Scope completed

Implemented the Billing Service-owned PostgreSQL persistence foundation for FIAP Phase 4:

- PostgreSQL configuration via `DATABASE_URL` and `DATABASE_POOL_MAX`.
- `pg` connection pool factory and database readiness checkers.
- Service-owned SQL migration for `billing_records`, `payment_attempts`, and `schema_migrations`.
- Bun migration runner (`bun run migrate`) that applies pending SQL files in transactions.
- Repository layer for billing records and gateway-agnostic payment attempts.
- `/ready` now includes PostgreSQL readiness and returns HTTP 503 when DB is unconfigured/unavailable.
- Unit tests for config, readiness, database checker, and repository SQL mapping.
- README, development guide, and OpenAPI readiness contract updates.

## Validation commands

| Command | Result | Notes |
|---|---|---|
| `npx --yes @fission-ai/openspec validate f4-billing-postgres --strict` | PASS | Change valid before implementation and after implementation |
| `bun add pg && bun add -d @types/pg` | PASS | Added PostgreSQL runtime/types dependencies |
| `npm install` | PASS | Updated npm lockfile; 0 vulnerabilities |
| `bun run lint` | PASS | `Checked 10 files ... No fixes applied.` |
| `bun run typecheck` | PASS | `tsc --noEmit` completed |
| `bun run test` | PASS | 17 pass, 0 fail |
| `bun run test:coverage` | PASS | 17 pass, 0 fail; 96.00% line coverage |
| `bun run build` | PASS | Bundled `src/index.ts` to `dist/index.js` |

## Notes

No live PostgreSQL integration test was run because no database service was provided in this task environment. The persistence boundary is covered by unit tests around the `Queryable` interface, and the migration runner is ready for environments with `DATABASE_URL` configured.
