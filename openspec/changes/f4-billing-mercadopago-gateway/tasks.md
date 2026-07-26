## 1. OpenSpec

- [x] 1.1 Create proposal, design notes, and spec deltas (new `billing-payment-gateway`
      capability; `MODIFIED` deltas for `billing-payment-contracts` and
      `billing-rabbitmq-compensation`).
- [x] 1.2 Validate the change with strict OpenSpec validation before archiving.

## 2. Gateway abstraction and adapter

- [x] 2.1 Add `PaymentGateway` interface (`charge`, `getStatus`) and
      `PaymentGatewayError` in `src/gateways/payment-gateway.ts`.
- [x] 2.2 Add `MercadoPagoGateway implements PaymentGateway` in
      `src/gateways/mercadopago-gateway.ts` using the Mercado Pago Payments API
      (Checkout API) with bearer authentication and status mapping.
- [x] 2.3 Add `getMercadoPagoConfig()` to `src/config/env.ts`, returning `undefined`
      when `MERCADOPAGO_ACCESS_TOKEN` is unset, mirroring `getRabbitMqConfig()`.
- [x] 2.4 Wire the gateway into `src/index.ts`, constructed only when configured, passed
      through the routes options bag.

## 3. Route integration

- [x] 3.1 Extend `POST /billing-records/:id/payment-attempts` to charge through the
      configured gateway at creation time, recording success or failure without
      duplicating the idempotency-replay logic.
- [x] 3.2 Extend `POST /billing-records/:id/payment-attempts/:attemptId/status` (reused,
      not duplicated) to resolve status via `providerReference` + the gateway's status
      operation when no explicit `status` is supplied.
- [x] 3.3 Update `docs/openapi.yaml` for the new optional `payerEmail` field, the
      `providerReference`-based status report shape, and the new `502`/`503` responses.

## 4. Tests

- [x] 4.1 Add `src/gateways/mercadopago-gateway.test.ts` with a hand-rolled `fetch` stub
      covering successful charge, status mapping variants, non-2xx errors, and network
      failures.
- [x] 4.2 Add a hand-rolled `FakePaymentGateway` test double in `src/routes/billing.test.ts`
      and cover: successful charge wiring, failed charge recording, webhook-style status
      resolution, gateway error on status resolution, and unconfigured-gateway rejection.
- [x] 4.3 Add `getMercadoPagoConfig()` coverage to `src/config/env.test.ts`.

## 5. Documentation and boundaries

- [x] 5.1 Update `AGENTS.md` to remove the stale "do not implement a payment gateway"
      scaffold-phase boundary and record that Fase 4 now implements one behind an
      optional abstraction.
- [x] 5.2 Update `README.md` with the Mercado Pago configuration section and updated
      endpoint descriptions.

## 6. Verification

- [x] 6.1 Run `bun install`, `bun run lint`, `bun test`, `bun run build`.
- [x] 6.2 Run `npx --yes @fission-ai/openspec validate f4-billing-mercadopago-gateway
      --strict`.
- [ ] 6.3 Run a live sandbox smoke test against the real Mercado Pago API. **Blocked**:
      no `MERCADOPAGO_ACCESS_TOKEN` is available in this environment; a human needs to
      provision a Mercado Pago sandbox account/test credentials first. Until then,
      evidence is limited to the `FakePaymentGateway`-driven route tests and the
      mocked-`fetch` `MercadoPagoGateway` test suite.
