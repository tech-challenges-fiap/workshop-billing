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
| POST | /billing-records/:id/payment-attempts | Create or idempotently replay a payment attempt, charging through the configured payment gateway when one is set up |
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

Supported inbound routing keys are `billing.payment.authorize.requested`, `billing.payment.compensation.requested`, `billing.payment.cancel.requested`, and `billing.payment.refund.requested`. Outbound events are gateway-agnostic `billing.payment.status.changed` and `billing.payment.compensation.completed` envelopes. The RabbitMQ authorization handler does not invoke a concrete payment gateway in this change; only the synchronous REST payment-attempt flow does.

## Payment Gateway (Mercado Pago)

Concrete payment gateway integration is optional and disabled by default. It is only wired up when `MERCADOPAGO_ACCESS_TOKEN` is provided; without it, `POST /billing-records/:id/payment-attempts` stays gateway-agnostic exactly as before (callers supply their own opaque `provider`/`providerReference`).

```bash
export MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Optional, defaults to https://api.mercadopago.com:
export MERCADOPAGO_BASE_URL=https://api.mercadopago.com
```

When configured:

- `POST /billing-records/:id/payment-attempts` calls `PaymentGateway#charge` at creation time and persists the returned `provider`, `providerReference`, and status. A failed charge still creates the attempt, recorded with status `failed` and the error in `metadata.gatewayError`, and updates the billing record status accordingly.
- `POST /billing-records/:id/payment-attempts/:attemptId/status` additionally accepts `{ "providerReference": "<id>" }` (instead of an explicit `status`) to resolve the authoritative status via `PaymentGateway#getStatus` — this is how a Mercado Pago webhook notification (which only reliably carries a payment id) is translated into a status update without trusting an unauthenticated webhook body directly.

The `PaymentGateway` interface (`src/gateways/payment-gateway.ts`) and its Mercado Pago adapter (`src/gateways/mercadopago-gateway.ts`) follow the same optional-integration pattern as `MessagePublisher`/RabbitMQ: an interface close to its consumer, an opt-in config accessor that returns `undefined` when unset, and wiring in `src/index.ts`.

**Note:** no sandbox `MERCADOPAGO_ACCESS_TOKEN` was available while building this integration; it is verified with a hand-rolled `FakePaymentGateway` test double and a mocked-`fetch` test suite for `MercadoPagoGateway`. A live sandbox smoke test is a pending human follow-up (see `openspec/changes/f4-billing-mercadopago-gateway`).

## Documentation

- [Development guide](docs/development.md)
- [OpenSpec changes](openspec/)

## Tech Stack

- Runtime: [Bun](https://bun.sh)
- Framework: [Hono](https://hono.dev)
- Language: TypeScript
- Testing: Bun test
