# workshop-billing

Billing Service for FIAP Tech Challenge Phase 4.

Handles billing records, invoices, and payment event ingestion for the workshop platform.

Persistence is owned by this service through its own PostgreSQL schema and migrations.

## Quick Start

```bash
bun install
bun run dev
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness probe |
| GET | /ready | Readiness probe, including PostgreSQL connectivity |
| POST | /billing-records | Create or idempotently replay a billing record |
| GET | /billing-records/:id/quote | Return the payable quote for a billing record |
| POST | /billing-records/:id/payment-attempts | Create or idempotently replay a gateway-agnostic payment attempt |
| POST | /billing-records/:id/payment-attempts/:attemptId/status | Report payment status and update billing status |

See [OpenAPI contract](docs/openapi.yaml) for request and response schemas.

## Database

```bash
export DATABASE_URL=postgres://billing:billing@localhost:5432/workshop_billing
bun run migrate
```

`/ready` returns HTTP 503 when `DATABASE_URL` is not configured or PostgreSQL is unavailable.

## RabbitMQ

RabbitMQ integration is optional and disabled unless a broker URL and consumer flag are provided. When enabled, the service declares a topic exchange and consumes Billing-owned authorization and compensation intents without requiring other service database access.

```bash
export RABBITMQ_URL=amqp://guest:guest@localhost:5672
export RABBITMQ_CONSUMERS_ENABLED=true
# Optional defaults:
export RABBITMQ_EXCHANGE=workshop.events
export RABBITMQ_AUTHORIZATION_QUEUE=workshop-billing.payment-authorize
export RABBITMQ_COMPENSATION_QUEUE=workshop-billing.payment-compensation
```

Supported inbound routing keys are `billing.payment.authorize.requested`, `billing.payment.compensation.requested`, `billing.payment.cancel.requested`, and `billing.payment.refund.requested`. Outbound events are gateway-agnostic `billing.payment.status.changed` and `billing.payment.compensation.completed` envelopes.

## Documentation

- [Development guide](docs/development.md)
- [OpenSpec changes](openspec/)

## Tech Stack

- Runtime: [Bun](https://bun.sh)
- Framework: [Hono](https://hono.dev)
- Language: TypeScript
- Testing: Bun test
