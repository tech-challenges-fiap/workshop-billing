# f4-billing-sonarcloud-quality-gate — Proposal

**Status:** Accepted
**Author:** Phase 4 Team
**Date:** 2026-07-26

## Why

Phase 4 closure requires static-analysis and quality-gate scanning in CI for `workshop-app`, `workshop-billing`, and `workshop-execution`. None of the six repositories in the platform currently run SonarQube/SonarCloud, and `workshop-billing` does not persist test coverage anywhere today. This change closes that gap for the Billing Service by producing lcov coverage in the existing `ci` job and scanning it with SonarCloud, without making the `ci` job's existing Lint/Test/Build/Docker steps depend on the scan result.

`ci` is the sole **required status check** for both `stag` and `prod` branch protection on this repo (confirmed via `gh api repos/tech-challenges-fiap/workshop-billing/branches/stag/protection`). Because this repo has only one job, any step failure fails that whole required check — so the `Sonar` step must be explicitly non-blocking (`continue-on-error: true`) until `SONAR_TOKEN` exists, or it would block every PR into `stag`/`prod`.

## What Changes

- Confirm `package.json` already has `test:coverage` (`bun test --coverage`) and make it actually emit `coverage/lcov.info` by adding a `bunfig.toml` with `[test]` `coverageReporter = ["text", "lcov"]` and `coverageDir = "coverage"`.
- Change the `Test` step in the single `ci` job of `.github/workflows/pr-validation.yml` to run `bun run test:coverage` instead of `bun test`.
- Add a `Sonar` step as the last step of the `ci` job, after `Test`, `Build`, and `Docker build`, using `SonarSource/sonarqube-scan-action@v8.2.1` (the current, non-deprecated action; `SonarSource/sonarcloud-github-action` is archived and redirects to this action), reading `SONAR_TOKEN` from repository secrets, with `continue-on-error: true` so it cannot fail the required `ci` status check. Running it last (not immediately after `Test`) ensures Lint/Test/Build/Docker build all complete and report their own real pass/fail status first.
- Add a `sonar-project.properties` file at the repo root: `sonar.projectKey=tech-challenges-fiap_workshop-billing`, `sonar.sources=src`, `sonar.tests=src` with `sonar.test.inclusions=**/*.test.ts` and `sonar.exclusions=**/*.test.ts` (so co-located `*.test.ts` files are classified as tests, not double-counted as production source), and `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.

## Scope

**In scope:**
- `bunfig.toml` coverage configuration.
- `.github/workflows/pr-validation.yml` `ci` job: `Test` step change plus new non-blocking `Sonar` step placed last.
- `sonar-project.properties` at repo root, including test-file classification.

**Out of scope:**
- Provisioning the actual SonarCloud organization/project or the `SONAR_TOKEN` GitHub secret — a human must create the SonarCloud org and run `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-billing`. Until then the `Sonar` step is expected to fail, but `continue-on-error: true` keeps that failure from blocking the required `ci` check; Lint/Test/Build/Docker build remain their own steps in the same job and already report pass/fail independently by the time the Sonar step runs.
- Enforcing a hard Sonar Quality Gate wait/fail in this first pass.
- Any change to billing domain logic, messaging, or persistence behavior.

## Decision

Persist coverage via a version-controlled `bunfig.toml` rather than only a CLI flag, so both local `bun run test:coverage` and CI runs behave identically. Add the Sonar step to the existing single `ci` job (this repo only has one `ci` job) as the last step, after `Test` and `Build`/`Docker build`, so the `coverage/lcov.info` artifact is present on the same runner without cross-job artifact upload/download. Give the step `continue-on-error: true` rather than splitting Sonar into a second job: this repo's convention is a single `ci` job, and adding a second job would require `actions/upload-artifact`/`actions/download-artifact` to move `coverage/lcov.info` between runners for no added benefit over the simpler in-job flag. Pin `SonarSource/sonarqube-scan-action@v8.2.1` — `SonarSource/sonarcloud-github-action` is archived (GitHub reports `archived: true`, description "Deprecated. Use https://github.com/SonarSource/sonarqube-scan-action instead"); the two actions share the same input names, so no other step config changed.

## Risks

- Until `SONAR_TOKEN` exists, the `Sonar` step will show as failed (non-blocking) in the `ci` job's step list, but the job's overall/required status stays green as long as Lint/Test/Build/Docker build themselves pass, thanks to `continue-on-error: true`. This is expected and accepted per the Phase 4 closure plan; the human follow-up (`gh secret set SONAR_TOKEN`) resolves the Sonar step's own outcome.
- Bun's coverage instrumentation adds minor overhead to `bun run test:coverage`, only in CI and when developers opt in locally; plain `bun test` is unaffected apart from also picking up the `bunfig.toml` `coverage = true` default (coverage report is printed to console but the job doesn't fail).
