## ADDED Requirements

### Requirement: Billing payment REST contracts

The Billing Service SHALL expose REST contracts for creating billing records, reading quotes, creating payment attempts, and reporting payment status without coupling callers to a payment gateway implementation.

#### Scenario: Billing record is created idempotently

- **GIVEN** a valid billing creation request with order id, customer id, amount, currency, idempotency key, and correlation id
- **WHEN** a client calls `POST /billing-records`
- **THEN** the service persists the billing record in Billing-owned PostgreSQL storage
- **AND** the response is HTTP 201 with the billing record contract
- **AND** repeating the same request with the same idempotency key returns the existing billing record instead of creating another row

#### Scenario: Billing quote is returned

- **GIVEN** an existing billing record
- **WHEN** a client calls `GET /billing-records/{billingRecordId}/quote`
- **THEN** the service returns HTTP 200 with amount, currency, billing status, and whether payment may be attempted

#### Scenario: Payment attempt is created idempotently

- **GIVEN** an existing billing record and a valid gateway-agnostic payment-attempt request
- **WHEN** a client calls `POST /billing-records/{billingRecordId}/payment-attempts`
- **THEN** the service persists a payment attempt linked to the billing record
- **AND** the response is HTTP 201 with the payment attempt contract
- **AND** repeating the same request with the same idempotency key returns the existing attempt instead of creating another row

#### Scenario: Payment status is reported

- **GIVEN** an existing payment attempt for a billing record
- **WHEN** a client reports a valid payment attempt status
- **THEN** the service updates the payment attempt status
- **AND** it updates the billing record status using the gateway-agnostic status mapping
- **AND** it returns the updated attempt and billing record status

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

The Billing Service SHALL store payment contract state inside Billing-owned PostgreSQL tables using parameterized repository methods and SHALL NOT integrate a concrete gateway or RabbitMQ compensation in this change.

#### Scenario: Contract metadata remains gateway agnostic

- **GIVEN** a payment attempt request with optional provider, provider reference, and metadata
- **WHEN** the repository creates the attempt
- **THEN** the fields are stored on the Billing-owned `payment_attempts` table
- **AND** no external gateway call or RabbitMQ compensation action is performed

#### Scenario: Correlation fields are persisted

- **GIVEN** billing record and payment attempt creation requests with correlation ids and idempotency keys
- **WHEN** the repository persists the records
- **THEN** those values are written to Billing-owned columns and returned in mapped domain contracts
