# Documentation

- [Development guide](development.md)
- [API spec (OpenAPI)](api.yaml)

## Architecture

```
workshop-billing (this service)
│
├── src/
│   ├── index.ts          — Bun/Hono server entry point
│   └── routes/
│       └── health.ts     — GET /health, GET /ready
│
├── docs/
│   ├── api.yaml          — OpenAPI 3.1 spec
│   └── development.md    — Local dev guide
│
└── openspec/
    └── changes/          — OpenSpec governance proposals
```

## Service Responsibilities (Phase 4 scope)

| Responsibility | Status |
|---|---|
| Health / readiness probes | Implemented (scaffold) |
| Billing record CRUD | Planned |
| Invoice generation | Planned |
| Payment event ingestion | Planned |
