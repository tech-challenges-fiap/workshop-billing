## MODIFIED Requirements

### Requirement: Payment authorization command handling

The Billing Service SHALL handle payment authorization request messages by creating or
replaying Billing-owned records and attempts without invoking a concrete payment gateway
synchronously as part of message handling. This is a deliberate scope boundary for the
asynchronous RabbitMQ-driven authorization flow, not a statement that the service has no
concrete gateway integration: a concrete `PaymentGateway` (Mercado Pago) now exists and is
used by the synchronous REST payment-attempt contract (see the `billing-payment-gateway`
and `billing-payment-contracts` capabilities). Synchronizing the RabbitMQ authorization
saga with the concrete gateway is deferred to a future change.

#### Scenario: Authorization request creates processing attempt

- **GIVEN** a valid `billing.payment.authorize.requested` envelope with order, customer,
  amount, currency, correlation, and idempotency data
- **WHEN** the Billing handler processes the command
- **THEN** it creates or reuses a Billing-owned billing record
- **AND** it creates or reuses a Billing-owned payment attempt in `processing` status
- **AND** it updates the billing record to `processing`
- **AND** it publishes a gateway-agnostic payment status event with the same correlation
  id

#### Scenario: Authorization retry is idempotent

- **GIVEN** an authorization request whose idempotency key or event id was already
  processed
- **WHEN** the Billing handler processes the command again
- **THEN** it reuses existing Billing-owned state
- **AND** it does not create duplicate billing records or payment attempts
