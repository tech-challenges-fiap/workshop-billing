# f4-billing-sonarcloud-quality-gate — Tasks

## OpenSpec

- [x] Create proposal, design notes, and specification delta.
- [x] Validate the change with strict OpenSpec validation before implementation.

## Implementation

- [x] Add `bunfig.toml` with `[test]` `coverage = true`, `coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`.
- [x] Confirm `bun run test:coverage` produces a non-empty `coverage/lcov.info`.
- [x] Add `sonar-project.properties` at repo root (`sonar.projectKey=tech-challenges-fiap_workshop-billing`, `sonar.sources=src`, `sonar.tests=src`, `sonar.test.inclusions=**/*.test.ts`, `sonar.exclusions=**/*.test.ts`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`).
- [x] Update the `Test` step in the `ci` job of `.github/workflows/pr-validation.yml` to run `bun run test:coverage`.
- [x] Add a `Sonar` step as the last step of the `ci` job using `SonarSource/sonarqube-scan-action@v8.2.1` with `SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}` and `continue-on-error: true`.

## Verification

- [x] Run `bun install`, `bun run lint`, `bun test`, `bun run test:coverage`, `bun run build`.
- [x] Sanity-check `.github/workflows/pr-validation.yml` parses as valid YAML.
- [x] Run OpenSpec strict validation before and after implementation.
- [x] Open a PR into `stag` referencing this change id, noting `SONAR_TOKEN` is not yet configured for `tech-challenges-fiap/workshop-billing` and the Sonar step is expected to fail until a human runs `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-billing`.

## Post-review fixes (Codex automated review on PR #3)

- [x] Discovered `ci` is this repo's sole required branch-protection status check; a Sonar step failure (guaranteed until `SONAR_TOKEN` exists), even placed last, would still fail the whole required `ci` job. Added `continue-on-error: true` to the `Sonar` step with an explanatory comment.
- [x] Discovered `SonarSource/sonarcloud-github-action` is archived/deprecated. Switched to `SonarSource/sonarqube-scan-action@v8.2.1` (latest release per `gh release list --repo SonarSource/sonarqube-scan-action`); confirmed input names are unchanged.
- [x] Added `sonar.tests=src`, `sonar.test.inclusions=**/*.test.ts`, and `sonar.exclusions=**/*.test.ts` to `sonar-project.properties` so co-located `*.test.ts` files are classified as tests, not double-counted as production source.
- [x] Re-ran full verification (`bun install`, `bun run lint`, `bun test`, `bun run test:coverage`, `bun run build`, `openspec validate --strict`, YAML sanity check) after the fixes.
