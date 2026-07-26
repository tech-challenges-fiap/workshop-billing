# f4-billing-sonarcloud-quality-gate — Proposal

**Status:** Accepted
**Author:** Phase 4 Team
**Date:** 2026-07-26

## Why

Phase 4 closure requires static-analysis and quality-gate scanning in CI for `workshop-app`, `workshop-billing`, and `workshop-execution`. None of the six repositories in the platform currently run SonarQube/SonarCloud, and `workshop-billing` does not persist test coverage anywhere today. This change closes that gap for the Billing Service by producing lcov coverage in the existing `ci` job and scanning it with SonarCloud, without making the `ci` job's existing Lint/Test/Build/Docker steps depend on the scan result.

## What Changes

- Confirm `package.json` already has `test:coverage` (`bun test --coverage`) and make it actually emit `coverage/lcov.info` by adding a `bunfig.toml` with `[test]` `coverageReporter = ["text", "lcov"]` and `coverageDir = "coverage"`.
- Change the `Test` step in the single `ci` job of `.github/workflows/pr-validation.yml` to run `bun run test:coverage` instead of `bun test`.
- Add a `Sonar` step as the last step of the `ci` job, after `Test`, `Build`, and `Docker build`, using `SonarSource/sonarcloud-github-action@v3.1.0`, reading `SONAR_TOKEN` from repository secrets. Running it last (not immediately after `Test`) ensures Lint/Test/Build/Docker build all complete and report their own real pass/fail status before a Sonar failure (e.g. missing token) would otherwise halt the job and skip later steps.
- Add a `sonar-project.properties` file at the repo root: `sonar.projectKey=tech-challenges-fiap_workshop-billing`, `sonar.sources=src`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.

## Scope

**In scope:**
- `bunfig.toml` coverage configuration.
- `.github/workflows/pr-validation.yml` `ci` job: `Test` step change plus new `Sonar` step placed last.
- `sonar-project.properties` at repo root.

**Out of scope:**
- Provisioning the actual SonarCloud organization/project or the `SONAR_TOKEN` GitHub secret — a human must create the SonarCloud org and run `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-billing`. Until then the `Sonar` step is expected to fail; this does not block Lint/Test/Build/Docker build, which remain their own steps in the same job and already report pass/fail independently by the time the Sonar step runs.
- Enforcing a hard Sonar Quality Gate wait/fail in this first pass.
- Any change to billing domain logic, messaging, or persistence behavior.

## Decision

Persist coverage via a version-controlled `bunfig.toml` rather than only a CLI flag, so both local `bun run test:coverage` and CI runs behave identically. Add the Sonar step to the existing single `ci` job (this repo only has one `ci` job) as the last step, after `Test` and `Build`/`Docker build`, so the `coverage/lcov.info` artifact is present on the same runner without cross-job artifact upload/download, and so a missing-token Sonar failure does not cause GitHub Actions to skip Build/Docker build (steps in a job run sequentially and a failing step skips subsequent steps by default). Pin `SonarSource/sonarcloud-github-action@v3.1.0` — the latest non-deprecated release; `v4.0.0` and `v5.0.0` are deprecated wrappers that redirect to `SonarSource/sonarqube-scan-action` with a warning.

## Risks

- Until `SONAR_TOKEN` exists, the `Sonar` step fails on every CI run for this branch/PR, and the `ci` job will show an overall failed status even though Lint/Test/Build/Docker build all completed successfully as prior steps in the same job. This is expected and accepted per the Phase 4 closure plan; the human follow-up (`gh secret set SONAR_TOKEN`) resolves it.
- Bun's coverage instrumentation adds minor overhead to `bun run test:coverage`, only in CI and when developers opt in locally; plain `bun test` is unaffected apart from also picking up the `bunfig.toml` `coverage = true` default (coverage report is printed to console but the job doesn't fail).
