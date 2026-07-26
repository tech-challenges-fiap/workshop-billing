# f4-billing-sonarcloud-quality-gate — Design

## Coverage mechanism

`workshop-billing`'s installed Bun (1.3.11 in this workspace) exposes `--coverage`, `--coverage-reporter=<val>` (`text` and/or `lcov`, default `text`), and `--coverage-dir=<val>` (default `coverage`) per `bun test --help`. The persistent, version-controlled equivalent is a `bunfig.toml` `[test]` block:

```toml
[test]
coverage = true
coverageReporter = ["text", "lcov"]
coverageDir = "coverage"
```

This makes `bun run test:coverage` (already `bun test --coverage` in `package.json`) emit `coverage/lcov.info` deterministically, both locally and in CI, without relying on an undocumented CLI flag spelling.

## CI step placement

`workshop-billing` has a single `ci` job in `.github/workflows/pr-validation.yml` (Lint, Test, Build, Docker build). The `Sonar` step is inserted last, after `Test` and after `Build`/`Docker build`, so:

- `coverage/lcov.info` exists on the same runner filesystem before the scan runs (no artifact upload/download needed).
- Lint, Test, Build, and Docker build all run and report their own real pass/fail status before Sonar executes. GitHub Actions steps within a job run sequentially and a failing step skips subsequent steps by default, so placing Sonar last (rather than in the middle) guarantees the other four steps are never skipped because of a Sonar failure.

## Action version

`SonarSource/sonarcloud-github-action@v3.1.0` is pinned. `v4.0.0` and `v5.0.0` both redirect to `SonarSource/sonarqube-scan-action` and print a deprecation warning on every run; `v3.1.0` is the newest release of `sonarcloud-github-action` without that redirect/warning.

## Risks / Trade-offs

- Until `SONAR_TOKEN` exists, the `Sonar` step (and therefore the overall `ci` job) will show as failed, even though Lint/Test/Build/Docker build all completed successfully as earlier steps in the same job. Reviewers should check individual step status, not just overall job status, until the secret is configured.
