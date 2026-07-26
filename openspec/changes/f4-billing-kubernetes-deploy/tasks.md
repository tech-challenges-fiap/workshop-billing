# f4-billing-kubernetes-deploy — Tasks

## OpenSpec

- [x] Create proposal, design notes, and specification delta.
- [x] Validate the change with strict OpenSpec validation before implementation.

## Implementation

- [x] Add `k8s/base/{deployment,service,configmap,hpa,ingress}.yaml` and `k8s/base/kustomization.yaml` for `billing-service`.
- [x] Add `k8s/overlays/stag/` and `k8s/overlays/prod/` with `runtime-config.yaml` + `ingress-patch.yaml` (and `replicas-patch.yaml` only in `stag`).
- [x] Add `.github/workflows/deploy.yml` (build+push to ECR via OIDC, `aws eks update-kubeconfig`, run migrations, apply overlay, rollout status, smoke test `/health`).
- [x] Add a `k8s` job to `.github/workflows/pr-validation.yml` that runs `kubectl kustomize` against both overlays.
- [x] Disable the `Deploy` workflow after it exists on the default branch (`gh workflow disable Deploy`), keeping it dormant like `workshop-app`'s.

## Verification

- [x] Run `bun install`, `bun run lint`, `bun test`, `bun run build`.
- [x] Run `kubectl kustomize k8s/overlays/stag` and `kubectl kustomize k8s/overlays/prod` locally; confirm both render without error.
- [x] Run `npx --yes @fission-ai/openspec validate f4-billing-kubernetes-deploy --strict`.
- [x] Record evidence and archive the OpenSpec change once merged and the human-run `kind` cluster validation is complete.
