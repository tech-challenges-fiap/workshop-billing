# Agent Instructions — workshop-billing

This repository is the **Billing Service** for FIAP Tech Challenge Phase 4.

## Purpose

Handle billing records, invoice generation, and payment event ingestion. This service is isolated from the other workshop microservices and communicates via events.

## Repository Conventions

- Language: TypeScript
- Runtime: Bun
- Framework: Hono
- Tests: `bun test` (co-located `*.test.ts` files)
- Lint: Biome (`bun run lint`)
- Build: `bun run build`
- Coverage: `bun test --coverage`

## Key Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (hot reload)
bun run build        # Compile to dist/
bun run test         # Run tests
bun run lint         # Lint source
bun run typecheck    # Type check
```

## OpenSpec Governance

All non-trivial changes require an OpenSpec change under `openspec/changes/<id>/`. See `openspec/README.md`.

## Boundaries

- Do not share models or schemas with other services; duplicate types explicitly.
- Do not implement payment gateway integration in this scaffold phase.
- Expose only HTTP/REST endpoints; event consumers are internal.

## When Adding Features

1. Write or update the OpenSpec proposal first.
2. Run tests before committing.
3. Keep src/ and test coverage at ≥ 80%.
