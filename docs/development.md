# Development Guide

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.2
- Docker (optional, for container builds)

## Setup

```bash
bun install
```

## PostgreSQL persistence

The Billing Service owns its PostgreSQL database and schema. Configure it with:

```bash
export DATABASE_URL=postgres://billing:billing@localhost:5432/workshop_billing
export DATABASE_POOL_MAX=5 # optional
bun run migrate
```

Without `DATABASE_URL`, `/health` remains alive but `/ready` returns HTTP 503 because the
service cannot accept persisted billing work without its own database.

## Running locally

```bash
bun run dev   # hot-reload dev server on :3000
```

Probe it:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

## Testing

```bash
bun test              # run all tests
bun test --coverage   # with coverage report
```

Coverage target: ≥ 80% lines.

## Linting and formatting

```bash
bun run lint       # report issues
bun run lint:fix   # auto-fix
```

## Type checking

```bash
bun run typecheck
```

## Building

```bash
bun run build      # outputs to dist/
```

## Docker

```bash
docker build -t workshop-billing .
docker run -p 3000:3000 workshop-billing
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `DATABASE_URL` | unset | Billing Service PostgreSQL connection string |
| `DATABASE_POOL_MAX` | `5` | Maximum PostgreSQL pool size |

## CI expectations

Each PR must pass:
1. `bun run lint`
2. `bun run typecheck`
3. `bun test --coverage` (≥ 80% lines)
4. `bun run build`
5. `npx --yes @fission-ai/openspec validate <change-id> --strict`
6. Docker build
