## Why

Fase 4 requires the Billing Service to actually charge and reconcile payments through a
real payment gateway. Earlier phases deliberately deferred this (`service-scaffold`,
`billing-payment-contracts`, and `billing-rabbitmq-compensation` all state there is no
concrete gateway integration); that scaffold-phase decision no longer applies now that
Fase 4 closure requires it. This change adds a concrete, optional Mercado Pago adapter
behind a small `PaymentGateway` abstraction, following the same opt-in integration
pattern already used for RabbitMQ/`MessagePublisher`, so the service still runs
gateway-agnostic when no credentials are configured.

## What Changes

- Add a `PaymentGateway` interface (`charge`, `getStatus`) in a new `src/gateways/`
  module, decoupled from any specific provider.
- Add a concrete `MercadoPagoGateway implements PaymentGateway` using the Mercado Pago
  Payments API (Checkout API: create payment, query payment status), authenticated with
  a bearer `MERCADOPAGO_ACCESS_TOKEN`, using the platform `fetch` directly (no HTTP
  client wrapper exists elsewhere in this repo to reuse).
- Add `getMercadoPagoConfig()` to `src/config/env.ts`, mirroring `getRabbitMqConfig()`:
  returns `undefined` when `MERCADOPAGO_ACCESS_TOKEN` is absent, so the gateway remains
  disabled by default.
- Wire the gateway into `src/index.ts` the same way `MessagePublisher`/repositories are
  wired: constructed only when configured, passed through the routes options bag.
- Extend `POST /billing-records/:id/payment-attempts`: when a gateway is configured, the
  service calls `gateway.charge(...)` at creation time and persists the resulting
  provider, provider reference, and status (including a `failed` outcome when the charge
  throws), and also updates the billing record status. Gateway-agnostic behavior
  (client-supplied `provider`/`providerReference`, no billing-status side effect) is
  unchanged when no gateway is configured.
- Extend `POST /billing-records/:id/payment-attempts/:attemptId/status` (reused, not
  duplicated) to additionally accept `{ "providerReference": "<id>" }` instead of an
  explicit `status`, resolving the authoritative status via `gateway.getStatus(...)` —
  this is how a Mercado Pago webhook notification (which only reliably carries a payment
  id) is translated into a status update without trusting an unauthenticated webhook body
  directly.
- Add a hand-rolled `FakePaymentGateway` test double (no mocking library, matching this
  repo's existing fake-repository test style) covering a successful charge, a status
  query, and an error/failure path without needing real Mercado Pago credentials.
- Update `AGENTS.md`, `README.md`, and `docs/openapi.yaml` to reflect that a concrete,
  optional gateway integration now exists.

**BREAKING**: None. The integration is strictly additive and opt-in; behavior is
unchanged when `MERCADOPAGO_ACCESS_TOKEN` is not set.

## Capabilities

### New Capabilities

- `billing-payment-gateway`: The `PaymentGateway` abstraction, the concrete Mercado Pago
  adapter, its opt-in configuration, and the hand-rolled `FakePaymentGateway` test
  double.

### Modified Capabilities

- `billing-payment-contracts`: The REST payment-attempt and status-report contracts now
  support an optional concrete gateway charge/status-resolution path, superseding the
  prior blanket statement that this capability "SHALL NOT integrate a concrete gateway...
  in this change."
- `billing-rabbitmq-compensation`: Clarifies that the asynchronous RabbitMQ authorization
  handler still does not invoke the gateway synchronously in this change (that remains
  deliberately scoped out, deferred to a future saga-integration change) — now stated as
  an explicit scope boundary rather than as evidence that no concrete gateway exists
  anywhere in the service.

## Impact

- New files: `src/gateways/payment-gateway.ts`, `src/gateways/mercadopago-gateway.ts`,
  `src/gateways/mercadopago-gateway.test.ts`.
- Modified files: `src/config/env.ts` (+tests), `src/index.ts`, `src/routes/billing.ts`
  (+tests), `AGENTS.md`, `README.md`, `docs/openapi.yaml`.
- New environment variables: `MERCADOPAGO_ACCESS_TOKEN` (required to enable the
  integration), `MERCADOPAGO_BASE_URL` (optional, defaults to
  `https://api.mercadopago.com`).
- No new dependencies (uses the platform `fetch`); no database migration needed (the
  `provider`/`provider_reference`/`metadata` columns already exist from
  `002_payment_contract_fields.sql`).
- No live Mercado Pago sandbox account/access token is available in this environment.
  This change is verified with the hand-rolled `FakePaymentGateway` test double and a
  mocked-`fetch` test suite for `MercadoPagoGateway`; a live sandbox smoke test is a
  pending human follow-up.
