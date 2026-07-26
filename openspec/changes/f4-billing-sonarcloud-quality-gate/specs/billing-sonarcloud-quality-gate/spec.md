## ADDED Requirements

### Requirement: CI produces persisted lcov coverage

The Billing Service SHALL emit a `coverage/lcov.info` file when `bun run test:coverage` runs, using a version-controlled `bunfig.toml` `[test]` configuration.

#### Scenario: Coverage script runs locally or in CI

- **GIVEN** the repository's `bunfig.toml` sets `coverage = true`, `coverageReporter = ["text", "lcov"]`, and `coverageDir = "coverage"`
- **WHEN** `bun run test:coverage` is executed, locally or in the `ci` job of `.github/workflows/pr-validation.yml`
- **THEN** a non-empty `coverage/lcov.info` file is produced in the repository's `coverage/` directory

### Requirement: CI runs a SonarCloud scan without blocking earlier steps

The single `ci` job in `.github/workflows/pr-validation.yml` SHALL include a `Sonar` step that runs `SonarSource/sonarcloud-github-action` against `coverage/lcov.info`, placed after Lint, Test, Build, and Docker build so those steps always run and report their own status first.

#### Scenario: Sonar step runs after coverage and build steps

- **GIVEN** the `ci` job's Lint, Test, Build, and Docker build steps have already executed
- **WHEN** the `Sonar` step runs
- **THEN** it uses `SonarSource/sonarcloud-github-action@v3.1.0`, reads `SONAR_TOKEN` from `secrets.SONAR_TOKEN`, and reads `sonar.javascript.lcov.reportPaths` from `sonar-project.properties` pointing at the coverage produced by the preceding `Test` step

#### Scenario: SONAR_TOKEN secret is not yet configured

- **GIVEN** the `tech-challenges-fiap/workshop-billing` GitHub repository does not yet have a `SONAR_TOKEN` secret configured
- **WHEN** the `ci` job runs
- **THEN** Lint, Test, Build, and Docker build complete and report their real pass/fail status as earlier steps in the job
- **AND** the `Sonar` step fails, which is expected and does not retroactively invalidate the earlier steps' results

### Requirement: Project analysis configuration is declared at repo root

The Billing Service SHALL declare its SonarCloud project analysis configuration in a `sonar-project.properties` file at the repository root.

#### Scenario: Sonar scanner reads project configuration

- **GIVEN** `sonar-project.properties` exists at the repository root
- **WHEN** the `Sonar` step runs the SonarCloud scanner
- **THEN** it reads `sonar.projectKey=tech-challenges-fiap_workshop-billing`, `sonar.sources=src`, and `sonar.javascript.lcov.reportPaths=coverage/lcov.info`
