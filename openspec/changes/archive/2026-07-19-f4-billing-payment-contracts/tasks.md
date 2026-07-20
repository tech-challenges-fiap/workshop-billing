# f4-billing-payment-contracts — Tasks

## OpenSpec

- [x] Create proposal, design notes, and specification delta.
- [x] Validate the change with strict OpenSpec validation before implementation.

## Implementation

- [x] Add Billing-owned persistence contract fields for idempotency and correlation ids.
- [x] Add repository methods for idempotent billing creation, quote lookup, payment attempt creation, payment status transitions, and mapping.
- [x] Add REST routes for billing records, quotes, payment attempts, and status reporting.
- [x] Add request validation and stable error responses.
- [x] Update OpenAPI/README contract documentation.

## Verification

- [x] Add route/contract tests for success, idempotency, validation, and status transitions.
- [x] Add repository boundary/mapping tests for new SQL behavior.
- [x] Run OpenSpec strict validation before and after implementation.
- [x] Run lint, typecheck, tests, coverage, and build.
- [x] Record evidence and archive the OpenSpec change when complete.
