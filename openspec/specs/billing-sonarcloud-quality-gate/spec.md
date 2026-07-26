# billing-sonarcloud-quality-gate Specification

## Purpose
Wires a non-blocking SonarCloud static analysis scan into the Billing Service's CI pipeline, backed by persisted lcov coverage, so quality metrics are tracked without risking the required `ci` status check before `SONAR_TOKEN` is configured.

## Requirements
### Requirement: CI produces persisted lcov coverage

The Billing Service SHALL emit a `coverage/lcov.info` file when `bun run test:coverage` runs, using a version-controlled `bunfig.toml` `[test]` configuration.

#### Scenario: Coverage script runs locally or in CI

- **GIVEN** the repository's `bunfig.toml` sets `coverage = true`, `coverageReporter = ["text", "lcov"]`, and `coverageDir = "coverage"`
- **WHEN** `bun run test:coverage` is executed, locally or in the `ci` job of `.github/workflows/pr-validation.yml`
- **THEN** a non-empty `coverage/lcov.info` file is produced in the repository's `coverage/` directory

### Requirement: CI runs a SonarCloud scan without failing the required ci check

The single `ci` job in `.github/workflows/pr-validation.yml` — this repo's sole required branch-protection status check on `stag` and `prod` — SHALL include a `Sonar` step that runs `SonarSource/sonarqube-scan-action` against `coverage/lcov.info`, placed after Lint, Test, Build, and Docker build, and configured so the Sonar step's own failure cannot fail the `ci` job or its required status check.

#### Scenario: Sonar step runs after coverage and build steps

- **GIVEN** the `ci` job's Lint, Test, Build, and Docker build steps have already executed
- **WHEN** the `Sonar` step runs
- **THEN** it uses `SonarSource/sonarqube-scan-action@v8.2.1` with `continue-on-error: true`, reads `SONAR_TOKEN` from `secrets.SONAR_TOKEN`, and reads `sonar.javascript.lcov.reportPaths` from `sonar-project.properties` pointing at the coverage produced by the preceding `Test` step

#### Scenario: SONAR_TOKEN secret is not yet configured

- **GIVEN** the `tech-challenges-fiap/workshop-billing` GitHub repository does not yet have a `SONAR_TOKEN` secret configured
- **WHEN** the `ci` job runs
- **THEN** Lint, Test, Build, and Docker build complete and report their real pass/fail status as earlier steps in the job
- **AND** the `Sonar` step fails, but because it has `continue-on-error: true` the failure does not fail the `ci` job or the required `ci` status check

### Requirement: Project analysis configuration is declared at repo root

The Billing Service SHALL declare its SonarCloud project analysis configuration in a `sonar-project.properties` file at the repository root, classifying co-located test files separately from production source.

#### Scenario: Sonar scanner reads project configuration

- **GIVEN** `sonar-project.properties` exists at the repository root
- **WHEN** the `Sonar` step runs the SonarCloud scanner
- **THEN** it reads `sonar.projectKey=tech-challenges-fiap_workshop-billing`, `sonar.sources=src`, and `sonar.javascript.lcov.reportPaths=coverage/lcov.info`

#### Scenario: Co-located test files are classified as tests, not production source

- **GIVEN** the Billing Service keeps `*.test.ts` files co-located with source files under `src/`
- **WHEN** the Sonar scanner analyzes the repository
- **THEN** it reads `sonar.tests=src` and `sonar.test.inclusions=**/*.test.ts` so files matching `**/*.test.ts` under `src/` are classified as test code
- **AND** it reads `sonar.exclusions=**/*.test.ts` so those same files are excluded from the production-source scan, preventing double-counting in coverage and issue metrics
