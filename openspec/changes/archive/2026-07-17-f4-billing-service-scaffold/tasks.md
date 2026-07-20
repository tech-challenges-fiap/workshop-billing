# f4-billing-service-scaffold — Tasks

Tracks implementation work for the scaffold change.

## Scaffold tasks

- [x] Create `.gitignore`
- [x] Create `README.md`
- [x] Create `AGENTS.md`
- [x] Create `package.json` with Bun/Hono/TypeScript/Biome dependencies
- [x] Create `tsconfig.json`
- [x] Create `biome.json`
- [x] Create `src/index.ts` — Hono app entry point
- [x] Create `src/routes/health.ts` — `/health` and `/ready` handlers
- [x] Create `src/routes/health.test.ts` — unit tests
- [x] Create `Dockerfile` (multi-stage, Bun-based)
- [x] Create `.dockerignore`
- [x] Create `docs/README.md`
- [x] Create `docs/development.md`
- [x] Create `docs/api.yaml` — OpenAPI 3.1 placeholder

## OpenSpec tasks

- [x] Create `openspec/README.md`
- [x] Create `openspec/changes/f4-billing-service-scaffold/proposal.md`
- [x] Create `openspec/changes/f4-billing-service-scaffold/tasks.md`
- [x] Create `openspec/changes/f4-billing-service-scaffold/design.md`
- [x] Create `openspec/changes/f4-billing-service-scaffold/specs/service-scaffold/spec.md`

## Validation

- [x] `bun install` — passes with Bun v1.3.14
- [x] `npm install` — dependency-resolution fallback completed
- [x] `npx tsc --noEmit` — local TypeScript validation proxy passes
- [x] `bun run typecheck` — passes with Bun v1.3.14
- [x] `bun test` — passes with Bun v1.3.14: 2 pass, 0 fail
- [x] `bun run lint` — passes with Bun v1.3.14
- [x] `bun run build` — passes with Bun v1.3.14
- [x] `npx --yes @fission-ai/openspec validate f4-billing-service-scaffold --strict` passes
