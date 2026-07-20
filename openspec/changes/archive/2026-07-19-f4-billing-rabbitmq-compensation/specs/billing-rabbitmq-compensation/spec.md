## ADDED Requirements

### Requirement: RabbitMQ event envelope boundary

The Billing Service SHALL parse and serialize RabbitMQ messages using a stable Billing-owned envelope containing `eventId`, `correlationId`, `schemaVersion`, `producer`, `type`, `occurredAt`, and `payload`.

#### Scenario: Valid envelope is accepted

- **GIVEN** a JSON message with all required envelope metadata and an object payload
- **WHEN** the Billing messaging layer parses the message
- **THEN** it returns a typed envelope preserving event id, correlation id, schema version, producer, type, occurrence time, and payload

#### Scenario: Invalid envelope is rejected

- **GIVEN** a malformed JSON message or an envelope missing required metadata
- **WHEN** the Billing messaging layer parses the message
- **THEN** it rejects the message before invoking Billing repositories or publishing outbound events

### Requirement: Payment authorization command handling

The Billing Service SHALL handle payment authorization request messages by creating or replaying Billing-owned records and attempts without calling a concrete payment gateway.

#### Scenario: Authorization request creates processing attempt

- **GIVEN** a valid `billing.payment.authorize.requested` envelope with order, customer, amount, currency, correlation, and idempotency data
- **WHEN** the Billing handler processes the command
- **THEN** it creates or reuses a Billing-owned billing record
- **AND** it creates or reuses a Billing-owned payment attempt in `processing` status
- **AND** it updates the billing record to `processing`
- **AND** it publishes a gateway-agnostic payment status event with the same correlation id

#### Scenario: Authorization retry is idempotent

- **GIVEN** an authorization request whose idempotency key or event id was already processed
- **WHEN** the Billing handler processes the command again
- **THEN** it reuses existing Billing-owned state
- **AND** it does not create duplicate billing records or payment attempts

### Requirement: Compensation intent handling

The Billing Service SHALL handle compensation, cancel, and refund intent messages using only Billing-owned state and SHALL publish a compensation result event.

#### Scenario: Existing billing record is canceled

- **GIVEN** a valid compensation intent envelope referencing an existing Billing-owned record by billing record id or order id
- **WHEN** the Billing handler processes the intent
- **THEN** it marks the billing record as `canceled`
- **AND** it cancels the latest related payment attempt when one exists
- **AND** it publishes `billing.payment.compensation.completed` with `completed` result and the same correlation id

#### Scenario: Missing billing record compensation is a no-op success

- **GIVEN** a valid compensation intent envelope referencing no Billing-owned record
- **WHEN** the Billing handler processes the intent
- **THEN** it does not access any Order Service or Execution Service database
- **AND** it publishes `billing.payment.compensation.completed` with `noop` result and the same correlation id

### Requirement: RabbitMQ runtime configuration

The Billing Service SHALL expose optional RabbitMQ runtime configuration for exchanges, queues, routing keys, and consumer enablement without requiring a live broker in unit tests.

#### Scenario: Broker is unconfigured

- **GIVEN** `RABBITMQ_URL` is absent or consumers are disabled
- **WHEN** the Billing application starts
- **THEN** the HTTP service remains available without attempting a RabbitMQ connection

#### Scenario: Broker configuration is parsed

- **GIVEN** RabbitMQ environment variables for URL, exchange, queue, and routing keys
- **WHEN** application configuration is loaded
- **THEN** the values are available to the messaging runtime with documented defaults for omitted optional fields
