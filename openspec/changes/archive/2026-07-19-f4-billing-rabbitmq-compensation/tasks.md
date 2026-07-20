# f4-billing-rabbitmq-compensation — Tasks

## OpenSpec

- [x] Create proposal, design notes, and specification delta.
- [x] Validate the change with strict OpenSpec validation before implementation.

## Implementation

- [x] Add RabbitMQ runtime configuration with opt-in consumer startup.
- [x] Add event envelope parsing/serialization with required metadata fields.
- [x] Add inbound handlers for payment authorization requests and compensation/cancel/refund intents.
- [x] Add outbound payment status and compensation result event publishing.
- [x] Add idempotency handling for retried commands/events using Billing-owned records.
- [x] Keep behavior gateway-agnostic and isolated from OS/Execution databases.

## Verification

- [x] Add unit tests for envelope validation, handler idempotency, status events, and compensation results.
- [x] Run OpenSpec strict validation before and after implementation.
- [x] Run lint, typecheck, tests, coverage, and build.
- [x] Record evidence and archive the OpenSpec change when complete.
