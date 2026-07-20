## ADDED Requirements

### Requirement: Billing Service scaffold

The Billing Service repository SHALL provide a minimal Bun, Hono, and TypeScript scaffold that establishes the Phase 4 Billing Service baseline without introducing payment gateway integration, billing record CRUD, invoice generation, database setup, or event consumer wiring in this change.

#### Scenario: Repository scaffold is present

- **GIVEN** a developer checks out the repository
- **WHEN** they inspect the project root
- **THEN** the repository includes `package.json`, `tsconfig.json`, `biome.json`, `Dockerfile`, `.dockerignore`, `.gitignore`, `README.md`, `AGENTS.md`, `docs/`, `src/`, and `openspec/`
- **AND** the scaffold is documented as the Billing Service boundary for Tech Challenge FIAP Phase 4

### Requirement: Health and readiness endpoints

The service SHALL expose HTTP liveness and readiness endpoints that are safe for local development, CI smoke tests, and future Kubernetes probes.

#### Scenario: Health endpoint returns liveness status

- **GIVEN** the Billing Service application is running
- **WHEN** a client calls `GET /health`
- **THEN** the service returns HTTP 200
- **AND** the response identifies the Billing Service or returns an explicit liveness status

#### Scenario: Readiness endpoint returns readiness status

- **GIVEN** the Billing Service application is running without external dependencies in this scaffold change
- **WHEN** a client calls `GET /ready`
- **THEN** the service returns HTTP 200
- **AND** the response indicates the service is ready to receive traffic

### Requirement: Validation and CI baseline

The scaffold SHALL define repeatable validation commands for type checking, linting, tests, build, and CI without requiring payment, database, or messaging infrastructure.

#### Scenario: Local validation commands are documented

- **GIVEN** a developer is preparing a Billing Service change
- **WHEN** they read the repository documentation
- **THEN** the documentation lists dependency installation, typecheck, lint, test, coverage, build, and Docker build commands
- **AND** those commands are scoped to the scaffold and health endpoints only

#### Scenario: CI expectations are defined

- **GIVEN** changes are pushed or submitted for review
- **WHEN** CI is configured from this scaffold
- **THEN** CI runs install, typecheck, lint, tests with coverage, build, and container validation for the scaffold

### Requirement: OpenAPI placeholder contract

The scaffold SHALL include an OpenAPI 3.1 document that describes the health and readiness endpoints and leaves future billing-domain APIs to later OpenSpec changes.

#### Scenario: OpenAPI contains scaffold endpoints only

- **GIVEN** a developer opens the API contract document
- **WHEN** they inspect the paths section
- **THEN** it documents `GET /health` and `GET /ready`
- **AND** it does not define payment, billing CRUD, invoice, database, or event endpoints

### Requirement: Future billing work remains gated

The scaffold SHALL not implement payment gateway integration, billing record CRUD, invoice generation, database setup, event consumers, or cross-service contracts until later OpenSpec changes define those capabilities.

#### Scenario: Scaffold avoids premature billing implementation

- **GIVEN** this change is complete
- **WHEN** a reviewer inspects the source tree
- **THEN** only scaffold, health, readiness, documentation, CI/tooling, Docker, and OpenSpec files are introduced
- **AND** any payment, billing domain, database, event, or downstream service behavior is absent or explicitly documented as future work
