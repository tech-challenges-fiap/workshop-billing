# f4-billing-sonarcloud-quality-gate — Tasks

## OpenSpec

- [x] Create proposal, design notes, and specification delta.
- [x] Validate the change with strict OpenSpec validation before implementation.

## Implementation

- [x] Add `bunfig.toml` with `[test]` `coverage = true`, `coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`.
- [x] Confirm `bun run test:coverage` produces a non-empty `coverage/lcov.info`.
- [x] Add `sonar-project.properties` at repo root (`sonar.projectKey=tech-challenges-fiap_workshop-billing`, `sonar.sources=src`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`).
- [x] Update the `Test` step in the `ci` job of `.github/workflows/pr-validation.yml` to run `bun run test:coverage`.
- [x] Add a `Sonar` step as the last step of the `ci` job using `SonarSource/sonarcloud-github-action@v3.1.0` with `SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}`.

## Verification

- [x] Run `bun install`, `bun run lint`, `bun test`, `bun run test:coverage`, `bun run build`.
- [x] Sanity-check `.github/workflows/pr-validation.yml` parses as valid YAML.
- [x] Run OpenSpec strict validation before and after implementation.
- [ ] Open a PR into `stag` referencing this change id, noting `SONAR_TOKEN` is not yet configured for `tech-challenges-fiap/workshop-billing` and the Sonar step (and therefore the `ci` job's overall status) is expected to fail until a human runs `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-billing`.
