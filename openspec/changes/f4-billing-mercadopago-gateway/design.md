## Context

The Billing Service's REST payment contracts (`billing-payment-contracts`, archived
2026-07-19) were built intentionally gateway-agnostic: `POST
/billing-records/:id/payment-attempts` accepts opaque `provider`/`providerReference`
fields but never calls anything. That was the right call for a scaffold phase, and
`AGENTS.md` recorded it as a boundary ("Do not implement payment gateway integration in
this scaffold phase"). Fase 4 closure now requires a real gateway, so this boundary is
being lifted for the REST payment-attempt/status surface specifically.

The repository already has one precedent for an optional external integration: RabbitMQ.
`getRabbitMqConfig()` (`src/config/env.ts`) returns `undefined` when `RABBITMQ_URL` is
unset; `MessagePublisher` (`src/messaging/handlers.ts`) is an interface defined close to
its consumer (`BillingMessageHandler`); the concrete `RabbitMqPublisher`
(`src/messaging/rabbitmq.ts`) is wired up only when configured, in `src/index.ts`. This
change follows the same shape for payments, but places the `PaymentGateway` interface in
its own `src/gateways/` module (mirroring how `DatabaseChecker` lives in
`src/database/postgres.ts` and is imported directly by both `src/routes/health.ts` and
`src/index.ts`), since `PaymentGateway` is consumed by the routes module rather than
authored there.

## Goals / Non-Goals

**Goals:**
- Provide a `PaymentGateway` abstraction (`charge`, `getStatus`) that is provider-neutral
  in shape.
- Implement `MercadoPagoGateway` against the real Mercado Pago Payments API (create
  payment, get payment by id).
- Keep the integration strictly opt-in: absent `MERCADOPAGO_ACCESS_TOKEN`, behavior is
  byte-for-byte identical to before this change.
- Let a Mercado Pago webhook drive a status update through the existing status endpoint
  (reused, not duplicated) by resolving the authoritative status through
  `gateway.getStatus(...)` rather than trusting a client-supplied status.
- Make the gateway-dependent code paths fully testable without live credentials via a
  hand-rolled `FakePaymentGateway`.

**Non-Goals:**
- Wiring the gateway into the asynchronous RabbitMQ authorization handler
  (`BillingMessageHandler.handleAuthorization`). That handler continues to create
  `processing` attempts without calling the gateway; synchronizing the saga-driven flow
  with a concrete gateway call is left to a future change, since it has different
  idempotency/retry semantics (broker redelivery vs. a single HTTP request/response).
- Signature verification of the Mercado Pago webhook payload itself (out of scope; the
  service only resolves status by querying Mercado Pago directly for the referenced
  payment, which limits blast radius of a forged webhook body to, at most, triggering an
  extra authenticated status lookup).
- A live sandbox smoke test — no `MERCADOPAGO_ACCESS_TOKEN` is available in this
  environment; a human needs to provision a sandbox account first.

## Decisions

**`PaymentGateway` interface location — `src/gateways/payment-gateway.ts`, not inlined in
the routes module.** The repo has two existing patterns: (a) `MessagePublisher` is
defined inside its consumer file (`handlers.ts`); (b) `DatabaseChecker` is defined in its
own module (`database/postgres.ts`) and imported directly by both the route and
`index.ts`. Pattern (b) fits better here because the payment-gateway contract is richer
(multiple methods, dedicated types for charge/status results) and has more than one
concrete implementation shape to test (`MercadoPagoGateway`, `FakePaymentGateway`), so it
benefits from its own home next to those implementations, exactly like
`DatabaseChecker`/`PostgresDatabaseChecker`/`UnconfiguredDatabaseChecker` live together.

**Charge input carries `orderId`/`customerId`/`amountCents`/`currency` from the billing
record, not from the request body.** The route already loads the billing record before
reaching the payment-attempt body validation; reusing those fields (rather than trusting
client-supplied amounts) prevents a client from charging an amount that disagrees with
the billing record it is paying against.

**`provider`/`providerReference` in the request body are overridden, not rejected, when a
gateway is configured.** Rejecting them would be a breaking contract change for existing
gateway-agnostic callers; silently overriding keeps the request shape stable while the
server-computed values are what get persisted.

**Failed charges still create a payment attempt (status `failed`), returning HTTP 201, not
an error status.** A charge attempt is itself a fact worth recording — resource creation
succeeded even though the underlying charge did not. The failure reason is captured in
`metadata.gatewayError`. This mirrors how the existing status-report endpoint records
`failed` as a normal status value rather than an HTTP error.

**Webhook status resolution reuses the existing status endpoint via a `providerReference`
body field, rather than adding a new route.** The task requirement was explicit that the
existing endpoint should be adapted, not duplicated. Branching only on how the target
`status` value is resolved (client-supplied vs. gateway-resolved) keeps the
persistence/response logic single-sourced.

**Mercado Pago status mapping.** `approved`/`accredited` → `succeeded`; `pending` →
`pending`; `in_process`/`in_mediation`/`authorized` → `processing`; `rejected` →
`failed`; `cancelled` → `canceled`; `refunded`/`charged_back` → treated conservatively
(`canceled`/`failed` respectively) since the Billing-owned `PaymentAttemptStatus` domain
has no direct equivalents; any unrecognized status defaults to `processing` rather than
silently mapping to a terminal state.

**Plain `fetch`, no HTTP client wrapper.** Checked the codebase for an existing outbound
HTTP convention (e.g. shared client, retry wrapper) — none exists (RabbitMQ uses `amqplib`
directly; PostgreSQL uses `pg` directly). `MercadoPagoGateway` follows the same
"call the SDK/protocol directly" convention using the platform `fetch`.

## Risks / Trade-offs

- [No live sandbox credentials in this environment] → Mitigated by a mocked-`fetch` unit
  test suite for `MercadoPagoGateway` covering success, provider rejection, non-2xx
  errors, and network failure, plus a `FakePaymentGateway`-driven route test suite. A
  live sandbox smoke test is called out as a pending human prerequisite before this can
  be considered fully verified end-to-end.
- [Webhook payload is not signature-verified] → Mitigated by never trusting the webhook
  body's own status claim; the service always re-queries Mercado Pago for the
  authoritative status by provider reference before applying any change.
- [RabbitMQ authorization handler remains gateway-agnostic] → Intentional and called out
  as a non-goal; documented in both `README.md` and the `billing-rabbitmq-compensation`
  spec delta so it isn't mistaken for an oversight.

## Migration Plan

No database migration is required (the `provider`/`provider_reference`/`metadata`
columns already exist from `002_payment_contract_fields.sql`). Deploying this change is
purely additive: set `MERCADOPAGO_ACCESS_TOKEN` (and optionally `MERCADOPAGO_BASE_URL`)
in the target environment to enable the integration; omit them to keep current
gateway-agnostic behavior. No rollback beyond unsetting the environment variable is
needed.

## Open Questions

- Should a future change synchronize the RabbitMQ-driven authorization saga with the
  concrete gateway (rather than only the synchronous REST path)? Deferred — see
  Non-Goals.
- Should Mercado Pago webhook signature verification be added before this reaches a
  production billing environment? Recommended as a fast-follow, tracked as a
  documentation note rather than blocking this change.
