# f4-billing-service-scaffold — Design Notes

## Application Structure

```
src/
├── index.ts          — Bun server export, mounts routes
└── routes/
    ├── health.ts     — Liveness + readiness probes
    └── health.test.ts
```

Routes are grouped by domain (`routes/<domain>.ts`). As the service grows, new domains (billing, invoices) get their own files.

## Framework Choice: Hono

Hono was chosen because:
- First-class Bun support
- Minimal overhead
- Web-standard Request/Response (easy to test without HTTP)
- Used by other workshop services

## Health vs Ready

- **`/health`** — liveness probe: responds `{ status: "ok" }` as long as the process is alive.
- **`/ready`** — readiness probe: same in the scaffold. Will include dependency checks (DB, downstream services) in future phases.

## CI Pipeline Design

```
lint → typecheck → test (with coverage) → build → docker build
```

All steps must pass for a PR to merge. Coverage gate: 80% lines.

## OpenAPI Strategy

`docs/api.yaml` is the source of truth for the HTTP contract. As new endpoints are added, the spec is updated before or alongside the implementation (spec-first where practical).

## Dockerfile Stages

| Stage | Purpose |
|---|---|
| `deps` | Install production deps only |
| `builder` | Compile via `bun build` |
| `runner` | Minimal image with compiled output |

The compiled output is a single bundled JS file, eliminating the need for `node_modules` at runtime (Bun bundler resolves all deps at build time).
