# f4-billing-payment-contracts — Design

## Contract shape

The Billing Service exposes gateway-agnostic REST contracts under `/billing-records`:

- `POST /billing-records` creates or replays a billing record by idempotency key.
- `GET /billing-records/:id/quote` returns the payable quote for a billing record.
- `POST /billing-records/:id/payment-attempts` creates or replays a payment attempt by idempotency key.
- `POST /billing-records/:id/payment-attempts/:attemptId/status` records a status update for an existing attempt and updates the parent billing status.

All write contracts accept a `correlationId` so later saga integration can trace retries and cross-service actions without sharing models.

## Validation

Validation is implemented at the HTTP boundary with explicit checks instead of shared external schemas. Invalid requests return HTTP 400 with a stable `{ error: { code, message, details } }` shape. Not found resources return HTTP 404 using the same error envelope.

## Persistence

The existing Billing-owned PostgreSQL tables remain the source of truth. This change adds Billing-owned columns only:

- `billing_records.idempotency_key` unique, required for public creation retries.
- `billing_records.correlation_id` required for saga tracing.
- `payment_attempts.idempotency_key` unique, required for public attempt retries.
- `payment_attempts.correlation_id` required for saga tracing.

Repository methods use parameterized SQL only and do not expose database-driver rows.

## Status mapping

Payment attempts support `pending`, `processing`, `succeeded`, `failed`, and `canceled`. Reporting an attempt status derives the billing record status as follows:

- `pending` -> billing `pending`
- `processing` -> billing `processing`
- `succeeded` -> billing `paid`
- `failed` -> billing `failed`
- `canceled` -> billing `canceled`

No gateway integration, RabbitMQ publishing, or compensation behavior is included.
