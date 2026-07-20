# Evidence — f4-billing-rabbitmq-compensation

## Scope

Implemented the Billing Service RabbitMQ event and compensation foundation for Phase 4 saga integration. The change adds optional RabbitMQ runtime configuration, a stable event envelope, gateway-agnostic authorization and compensation handlers using only Billing-owned repositories, outbound status/result events, and idempotent replay behavior. No live broker is required by tests.

## Implemented artifacts

- OpenSpec change: `openspec/changes/f4-billing-rabbitmq-compensation/`
- Messaging envelope: `src/messaging/envelope.ts`
- Authorization and compensation handlers: `src/messaging/handlers.ts`
- Optional RabbitMQ runtime adapter: `src/messaging/rabbitmq.ts`
- Runtime config updates: `src/config/env.ts`
- App startup wiring: `src/index.ts`
- Tests: `src/messaging/handlers.test.ts`, `src/config/env.test.ts`
- Documentation: `README.md`

## Validation results

Commands were executed from `/root/repos/tech-challenges-fiap/workshop-billing`.

| Command | Result |
|---|---|
| `npx --yes @fission-ai/openspec validate f4-billing-rabbitmq-compensation --strict` | Passed before implementation: `Change 'f4-billing-rabbitmq-compensation' is valid` |
| `npx --yes @fission-ai/openspec validate f4-billing-rabbitmq-compensation --strict` | Passed after implementation: `Change 'f4-billing-rabbitmq-compensation' is valid` |
| `bun run lint` | Passed: `Checked 16 files ... No fixes applied.` |
| `bun run typecheck` | Passed: `tsc --noEmit` |
| `bun run test` | Passed: 36 pass, 0 fail, 84 assertions |
| `bun run test:coverage` | Passed: 36 pass, 0 fail, 84 assertions; all-files coverage 93.24% funcs / 93.51% lines |
| `bun run build` | Passed: bundled `dist/index.js` |

## Caveats

- Runtime RabbitMQ consumers are opt-in via `RABBITMQ_URL` and `RABBITMQ_CONSUMERS_ENABLED=true`.
- Tests use in-memory publishers/repositories and do not require a live RabbitMQ broker.
- This change intentionally does not implement the OS distributed saga flow and does not access Order Service or Execution Service databases.
