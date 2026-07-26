# billing-payment-contracts Specification

## Purpose
Define the Billing Service-owned REST and persistence contracts for creating billing records, reading quotes, creating payment attempts, and reporting gateway-agnostic payment status for later saga integration.
## Requirements
### Requirement: Billing payment REST contracts

The Billing Service SHALL expose REST contracts for creating billing records, reading
quotes, creating payment attempts, and reporting payment status without requiring
callers to know the details of any specific payment gateway implementation. When a
concrete payment gateway is configured, the service MAY invoke it synchronously as part
of these contracts; when none is configured, the contracts remain fully gateway-agnostic
exactly as before.

#### Scenario: Billing record is created idempotently

- **GIVEN** a valid billing creation request with order id, customer id, amount,
  currency, idempotency key, and correlation id
- **WHEN** a client calls `POST /billing-records`
- **THEN** the service persists the billing record in Billing-owned PostgreSQL storage
- **AND** the response is HTTP 201 with the billing record contract
- **AND** repeating the same request with the same idempotency key returns the existing
  billing record instead of creating another row

#### Scenario: Billing quote is returned

- **GIVEN** an existing billing record
- **WHEN** a client calls `GET /billing-records/{billingRecordId}/quote`
- **THEN** the service returns HTTP 200 with amount, currency, billing status, and
  whether payment may be attempted

#### Scenario: Payment attempt is created idempotently

- **GIVEN** an existing billing record and a valid gateway-agnostic payment-attempt
  request
- **WHEN** a client calls `POST /billing-records/{billingRecordId}/payment-attempts`
- **THEN** the service persists a payment attempt linked to the billing record
- **AND** the response is HTTP 201 with the payment attempt contract
- **AND** repeating the same request with the same idempotency key returns the existing
  attempt instead of creating another row

#### Scenario: Payment attempt is charged through a configured gateway

- **GIVEN** an existing billing record, a valid payment-attempt request, and a configured
  `PaymentGateway`
- **WHEN** a client calls `POST /billing-records/{billingRecordId}/payment-attempts`
- **THEN** the service calls the gateway's charge operation using the billing record's
  amount and currency (not client-supplied values)
- **AND** it persists the payment attempt with the gateway's returned provider, provider
  reference, and status
- **AND** it updates the billing record status using the gateway-agnostic status mapping
- **AND** the response includes the updated billing record alongside the payment attempt

#### Scenario: Gateway charge failure is recorded, not rejected

- **GIVEN** an existing billing record, a valid payment-attempt request, and a configured
  `PaymentGateway` whose charge operation fails
- **WHEN** a client calls `POST /billing-records/{billingRecordId}/payment-attempts`
- **THEN** the service still persists a payment attempt, recorded with status `failed`
  and the failure reason in metadata
- **AND** the response is still HTTP 201, since the payment-attempt resource was created
- **AND** the billing record status is updated to reflect the failed attempt

#### Scenario: Gateway charge is rejected for an already-settled billing record

- **GIVEN** a billing record whose status is `paid` or `canceled` and a configured
  `PaymentGateway`
- **WHEN** a client calls `POST /billing-records/{billingRecordId}/payment-attempts` with
  a new idempotency key
- **THEN** the service returns HTTP 409 without calling the gateway's charge operation
- **AND** no payment attempt is persisted and no billing record status is changed

#### Scenario: Payment status is reported

- **GIVEN** an existing payment attempt for a billing record
- **WHEN** a client reports a valid payment attempt status
- **THEN** the service updates the payment attempt status
- **AND** it updates the billing record status using the gateway-agnostic status mapping
- **AND** it returns the updated attempt and billing record status

#### Scenario: Payment status is resolved via the configured gateway

- **GIVEN** an existing payment attempt for a billing record and a configured
  `PaymentGateway`
- **WHEN** a client reports a status update using `providerReference` instead of an
  explicit `status` (e.g. translating a Mercado Pago webhook notification)
- **THEN** the service resolves the authoritative status by calling the gateway's status
  operation with that provider reference, rather than trusting any status value supplied
  by the caller
- **AND** the resolved status is applied using the same update logic as an explicit
  status report

#### Scenario: Status resolution fails when the gateway is unavailable

- **GIVEN** a status report using `providerReference` with no `PaymentGateway` configured
- **WHEN** a client calls the status endpoint
- **THEN** the service returns HTTP 503 and does not update any payment attempt or
  billing record status

#### Scenario: Status resolution fails when the gateway errors

- **GIVEN** a status report using `providerReference` with a configured `PaymentGateway`
  whose status operation fails
- **WHEN** a client calls the status endpoint
- **THEN** the service returns HTTP 502 and does not update any payment attempt or
  billing record status

#### Scenario: Status resolution is rejected when the resolved reference does not match the attempt

- **GIVEN** a status report using `providerReference` with a configured `PaymentGateway`,
  where the gateway resolves that reference to a value different from the provider
  reference stored on the payment attempt identified by the URL
- **WHEN** a client calls the status endpoint
- **THEN** the service returns HTTP 409 without updating that payment attempt or its
  billing record status, so a stale or misrouted reference cannot be applied to the
  wrong attempt

### Requirement: Billing payment contract validation

The Billing Service SHALL validate all payment contract requests at the HTTP boundary and return stable error responses for malformed or missing fields.

#### Scenario: Invalid billing request is rejected

- **GIVEN** a billing creation request with missing or invalid order id, customer id, amount, currency, idempotency key, or correlation id
- **WHEN** the request is submitted
- **THEN** the service returns HTTP 400
- **AND** the response identifies validation failures without writing to the repository

#### Scenario: Invalid payment status is rejected

- **GIVEN** a payment status report with an unsupported status
- **WHEN** the request is submitted
- **THEN** the service returns HTTP 400
- **AND** no billing status transition is persisted

### Requirement: Gateway-agnostic payment persistence boundary

The Billing Service SHALL store payment contract state inside Billing-owned PostgreSQL
tables using parameterized repository methods. The persistence boundary MAY be populated
by an optional concrete payment gateway integration invoked through the `PaymentGateway`
abstraction (see the `billing-payment-gateway` capability) at payment-attempt creation
time and during status resolution; RabbitMQ-driven compensation continues to operate
without invoking a concrete gateway in this change (see the `billing-rabbitmq-compensation`
capability).

#### Scenario: Contract metadata remains gateway agnostic when unconfigured

- **GIVEN** a payment attempt request with optional provider, provider reference, and
  metadata, and no `PaymentGateway` configured
- **WHEN** the repository creates the attempt
- **THEN** the fields are stored on the Billing-owned `payment_attempts` table exactly as
  supplied by the caller
- **AND** no external gateway call or RabbitMQ compensation action is performed

#### Scenario: Contract metadata may include gateway invocation results when configured

- **GIVEN** a payment attempt request and a configured `PaymentGateway`
- **WHEN** the repository creates the attempt
- **THEN** the stored provider, provider reference, status, and metadata reflect the
  outcome of the gateway's charge operation rather than any client-supplied
  provider/providerReference values

#### Scenario: Correlation fields are persisted

- **GIVEN** billing record and payment attempt creation requests with correlation ids and idempotency keys
- **WHEN** the repository persists the records
- **THEN** those values are written to Billing-owned columns and returned in mapped domain contracts

