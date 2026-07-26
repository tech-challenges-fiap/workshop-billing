## ADDED Requirements

### Requirement: Payment gateway abstraction

The Billing Service SHALL define a provider-neutral `PaymentGateway` abstraction exposing
a `charge` operation and a `getStatus` operation, so that concrete gateway adapters can be
swapped without changing route or repository code.

#### Scenario: Charge operation contract

- **GIVEN** a `PaymentGateway` implementation
- **WHEN** `charge` is invoked with a billing record id, order id, customer id, amount in
  cents, currency, idempotency key, and correlation id
- **THEN** it resolves with a provider reference and a Billing-owned
  `PaymentAttemptStatus` value

#### Scenario: Status operation contract

- **GIVEN** a `PaymentGateway` implementation
- **WHEN** `getStatus` is invoked with a provider reference
- **THEN** it resolves with the provider reference and the current Billing-owned
  `PaymentAttemptStatus` value for that payment

### Requirement: Mercado Pago concrete adapter

The Billing Service SHALL provide a `MercadoPagoGateway` implementing `PaymentGateway`
against the Mercado Pago Payments API (Checkout API), authenticated using a bearer access
token, using the platform `fetch` for outbound HTTP calls.

#### Scenario: Charge creates a Mercado Pago payment

- **GIVEN** a configured `MercadoPagoGateway`
- **WHEN** `charge` is called
- **THEN** it issues an authenticated `POST /v1/payments` request to the Mercado Pago
  Payments API with the charge amount converted to decimal currency units and an
  idempotency header derived from the caller's idempotency key
- **AND** it maps the Mercado Pago payment status (e.g. `approved`, `pending`,
  `in_process`, `rejected`, `cancelled`) onto the Billing-owned `PaymentAttemptStatus`
  domain

#### Scenario: Status lookup queries Mercado Pago by payment id

- **GIVEN** a configured `MercadoPagoGateway`
- **WHEN** `getStatus` is called with a provider reference
- **THEN** it issues an authenticated `GET /v1/payments/{id}` request to the Mercado Pago
  Payments API
- **AND** it maps the returned status onto the Billing-owned `PaymentAttemptStatus`
  domain

#### Scenario: Gateway errors are surfaced distinctly

- **GIVEN** a configured `MercadoPagoGateway`
- **WHEN** the Mercado Pago API responds with a non-2xx status, an unparsable response
  body, or the underlying network request fails
- **THEN** the adapter rejects with a distinguishable gateway error rather than throwing
  a generic or unhandled exception

### Requirement: Optional opt-in gateway configuration

The Billing Service SHALL treat concrete payment gateway configuration as optional and
disabled unless explicitly configured, following the same opt-in pattern used for
RabbitMQ configuration.

#### Scenario: Gateway is unconfigured

- **GIVEN** `MERCADOPAGO_ACCESS_TOKEN` is absent from the process environment
- **WHEN** the Billing Service loads its application configuration
- **THEN** no Mercado Pago configuration is produced
- **AND** no `PaymentGateway` is constructed or wired into the routes

#### Scenario: Gateway configuration is parsed

- **GIVEN** `MERCADOPAGO_ACCESS_TOKEN` is present in the process environment
- **WHEN** the Billing Service loads its application configuration
- **THEN** a Mercado Pago configuration is produced with that access token
- **AND** `MERCADOPAGO_BASE_URL` overrides the documented default API base URL when
  provided

### Requirement: Hand-rolled test double for gateway-dependent tests

The Billing Service SHALL provide a hand-rolled `FakePaymentGateway` implementing
`PaymentGateway`, consistent with this repository's existing hand-rolled fake-repository
test style (no mocking library), so gateway-dependent behavior is testable without real
Mercado Pago credentials.

#### Scenario: Fake gateway supports a successful charge

- **GIVEN** a `FakePaymentGateway` configured to return a successful charge result
- **WHEN** a test exercises code that calls `charge`
- **THEN** the fake returns the scripted provider reference and status without any
  network access

#### Scenario: Fake gateway supports a status query

- **GIVEN** a `FakePaymentGateway` configured to return a status result
- **WHEN** a test exercises code that calls `getStatus`
- **THEN** the fake returns the scripted status without any network access

#### Scenario: Fake gateway supports an error/failure path

- **GIVEN** a `FakePaymentGateway` configured to throw for `charge` or `getStatus`
- **WHEN** a test exercises the corresponding operation
- **THEN** the fake rejects with the scripted error so error-handling behavior can be
  verified deterministically
