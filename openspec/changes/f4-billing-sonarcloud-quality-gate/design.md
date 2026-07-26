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

`workshop-billing` has a single `ci` job in `.github/workflows/pr-validation.yml` (Lint, Test, Build, Docker build), and `ci` is this repo's sole required branch-protection status check on `stag`/`prod` (`gh api repos/tech-challenges-fiap/workshop-billing/branches/stag/protection` lists only `ci`). The `Sonar` step is inserted last, after `Test` and after `Build`/`Docker build`, so:

- `coverage/lcov.info` exists on the same runner filesystem before the scan runs (no artifact upload/download needed).
- Lint, Test, Build, and Docker build all run and report their own real pass/fail status before Sonar executes. GitHub Actions steps within a job run sequentially and a failing step skips subsequent steps by default, so placing Sonar last (rather than in the middle) guarantees the other four steps are never skipped because of a Sonar failure.

**Required-check isolation (corrected after review):** placing Sonar last is not, by itself, enough — a GitHub Actions job's overall (and required-check) status is a failure if *any* step in it fails, regardless of position. Since `ci` is the only required check in this repo, an un-mitigated Sonar failure (guaranteed until `SONAR_TOKEN` exists) would still block every PR into `stag`/`prod`. The fix is `continue-on-error: true` on the `Sonar` step: its own result still shows (as a non-blocking warning), but it no longer counts toward the job's/required check's pass/fail outcome.

## Action version

`SonarSource/sonarqube-scan-action@v8.2.1` is pinned. `SonarSource/sonarcloud-github-action` (previously pinned at `v3.1.0`) is archived — its GitHub repo reports `archived: true` and its description reads "Deprecated. Use https://github.com/SonarSource/sonarqube-scan-action instead." The two actions expose the same inputs (`args`, `projectBaseDir`, `scannerVersion`, `scannerBinariesUrl`) and both read `SONAR_TOKEN`/`GITHUB_TOKEN` from the environment, so switching is a drop-in replacement.

## Test file classification

`workshop-billing` keeps `*.test.ts` files co-located with source under `src/`. `sonar.sources=src` alone would have Sonar analyze those test files as production code, skewing coverage and issue metrics. `sonar.tests=src` plus `sonar.test.inclusions=**/*.test.ts` classifies matching files as tests, and `sonar.exclusions=**/*.test.ts` removes them from the production-source scan so they are not double-counted.

## Risks / Trade-offs

- Until `SONAR_TOKEN` exists, the `Sonar` step will show as failed (non-blocking, via `continue-on-error: true`) in the `ci` job's step list, while the job's overall/required status stays green as long as Lint/Test/Build/Docker build pass. Reviewers should still check individual step status to see the Sonar step's real outcome.
