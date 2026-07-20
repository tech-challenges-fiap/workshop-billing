# Evidence — f4-billing-payment-contracts

Date: 2026-07-19

## Summary

Implemented Billing Service payment/billing contracts for later saga integration, without payment gateway integration and without RabbitMQ compensation.

## Implemented contracts

- `POST /billing-records` creates or idempotently replays a billing record using `idempotencyKey` and `correlationId`.
- `GET /billing-records/:id/quote` returns amount, currency, status, and `canAttemptPayment`.
- `POST /billing-records/:id/payment-attempts` creates or idempotently replays a gateway-agnostic payment attempt.
- `POST /billing-records/:id/payment-attempts/:attemptId/status` records payment status and maps it to billing status.
- Request validation returns stable `validation_error` responses.
- OpenAPI contract is documented in `docs/openapi.yaml`.
- PostgreSQL migration `002_payment_contract_fields.sql` adds Billing-owned idempotency/correlation columns and indexes.

## Validation commands

```text
$ npx --yes @fission-ai/openspec validate f4-billing-payment-contracts --strict
Change 'f4-billing-payment-contracts' is valid

$ bun run lint
$ bun x biome check src/
Checked 12 files in 19ms. No fixes applied.

$ bun run typecheck
$ tsc --noEmit

$ bun run test
29 pass
0 fail
69 expect() calls
Ran 29 tests across 5 files.

$ bun run test:coverage
All files: 91.59% funcs, 93.13% lines
29 pass
0 fail
69 expect() calls
Ran 29 tests across 5 files.

$ bun run build
$ bun build src/index.ts --outdir dist --target bun
Bundled 71 modules in 13ms
index.js 224.49 KB (entry point)

$ npx --yes @fission-ai/openspec validate f4-billing-payment-contracts --strict
Change 'f4-billing-payment-contracts' is valid

$ npx --yes @fission-ai/openspec archive f4-billing-payment-contracts --yes
Task status: ✓ Complete
Specs updated successfully.
Change 'f4-billing-payment-contracts' archived as '2026-07-19-f4-billing-payment-contracts'.

$ npx --yes @fission-ai/openspec validate --specs --strict
✓ spec/billing-payment-contracts
✓ spec/billing-postgres
✓ spec/service-scaffold
Totals: 3 passed, 0 failed (3 items)
```

## Caveats

- Repository tests mock the PostgreSQL query boundary; no live PostgreSQL instance was provisioned in this task.
- Payment gateway adapters and RabbitMQ compensation remain intentionally out of scope.
