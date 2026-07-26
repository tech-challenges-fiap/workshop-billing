# f4-billing-kubernetes-deploy — Tasks

## OpenSpec

- [x] Create proposal, design notes, and specification delta.
- [x] Validate the change with strict OpenSpec validation before implementation.

## Implementation

- [x] Add `k8s/base/{deployment,service,configmap,hpa,ingress}.yaml` and `k8s/base/kustomization.yaml` for `billing-service`.
- [x] Add `k8s/overlays/stag/` and `k8s/overlays/prod/` with `runtime-config.yaml` + `ingress-patch.yaml` + `hpa-patch.yaml` (and `replicas-patch.yaml` only in `stag`).
- [x] Add `.github/workflows/deploy.yml` (build+push to ECR via OIDC, `aws eks update-kubeconfig`, run migrations, apply overlay, rollout status, smoke test `/health`).
- [x] Add a `k8s` job to `.github/workflows/pr-validation.yml` that runs `kubectl kustomize` against both overlays.
- [x] Disable the `Deploy` workflow after it exists on the default branch (`gh workflow disable Deploy`), keeping it dormant like `workshop-app`'s.

## Review follow-up (automated PR review)

- [x] `deploy.yml`: drop the ambiguous `github.ref_name == 'stag' && X || Y` fallback pattern (which defaulted to production for any dispatch off a non-`stag` ref); require an explicit `environment` choice input for `workflow_dispatch`, validate it in a guard step that fails closed, and export `DEPLOY_TARGET`/`DEPLOY_NAMESPACE` for later steps.
- [x] `k8s/base/hpa.yaml`: raise `minReplicas` to `2` (prod's floor); add `k8s/overlays/stag/hpa-patch.yaml` (`minReplicas: 1`) and `k8s/overlays/prod/hpa-patch.yaml` (explicit `minReplicas: 2` pin) so prod cannot silently scale below 2 pods.
- [x] `deploy.yml`: percent-encode `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` with `jq`'s `@uri` filter before interpolating them into `DATABASE_URL`, in both the migration step and the runtime-secret step.

## Verification

- [x] Run `bun install`, `bun run lint`, `bun test`, `bun run build`.
- [x] Run `kubectl kustomize k8s/overlays/stag` and `kubectl kustomize k8s/overlays/prod` locally; confirm both render without error.
- [x] Run `npx --yes @fission-ai/openspec validate f4-billing-kubernetes-deploy --strict`.
- [x] Record evidence and archive the OpenSpec change once merged and the human-run `kind` cluster validation is complete.
