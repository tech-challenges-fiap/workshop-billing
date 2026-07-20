# f4-billing-rabbitmq-compensation — Design

## Messaging boundary

The Billing Service owns a small messaging module that does not expose database rows or depend on other services' schemas. Messages use a versioned envelope:

- `eventId`: unique event/command identifier used for handler idempotency.
- `correlationId`: saga trace identifier propagated to Billing-owned records and outbound events.
- `schemaVersion`: semantic contract version; this change supports `1`.
- `producer`: source service name for observability only.
- `type`: command or event name.
- `occurredAt`: ISO timestamp.
- `payload`: command/event body owned by this service boundary.

## Inbound commands

`billing.payment.authorize.requested` creates or replays a billing record and a payment attempt from payload fields (`orderId`, `customerId`, `amountCents`, `currency`, optional `billingRecordId`, optional `paymentAttemptId`, optional `idempotencyKey`). Because no gateway is integrated, a valid authorization request records a `processing` payment attempt and emits a processing status event.

`billing.payment.compensation.requested`, `billing.payment.cancel.requested`, and `billing.payment.refund.requested` are treated as compensation intents. The handler locates a Billing-owned record by `billingRecordId` or `orderId`, cancels the record and most recent relevant attempt when present, and emits a compensation result event. A missing Billing-owned record is a successful no-op result so saga retries can converge.

## Outbound events

The handler publishes through a `MessagePublisher` interface rather than a concrete broker:

- `billing.payment.status.changed` after authorization request handling.
- `billing.payment.compensation.completed` after compensation/cancel/refund intent handling.

Outbound events reuse the inbound correlation id and use Billing as producer. Tests use an in-memory publisher; runtime can use a RabbitMQ publisher when configured.

## Runtime adapter

RabbitMQ runtime configuration is optional and isolated to environment parsing and a small adapter. If `RABBITMQ_URL` is absent or consumers are disabled, the HTTP service still starts without broker access. If enabled, the adapter declares a topic exchange and queues/bindings for the supported routing keys. Tests do not require a live broker.

## Idempotency

Authorization idempotency prefers payload `idempotencyKey` and falls back to `eventId`. Existing billing records or attempts are replayed instead of recreated. Compensation is naturally idempotent: terminal canceled records/attempts are left canceled, and the same result event shape is emitted for retried commands.
