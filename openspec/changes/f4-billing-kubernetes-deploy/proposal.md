# f4-billing-kubernetes-deploy — Proposal

**Status:** Done
**Author:** Phase 4 Team
**Date:** 2026-07-26

## Why

Fase 4 closure requires every Phase 4 service to reach the same Kubernetes
deploy-manifest parity that `workshop-app` already has. `workshop-billing`
currently has no Kubernetes manifests and no deploy workflow, so it cannot be
rolled out to the shared EKS cluster the way `workshop-app` can.

## What Changes

- Add `k8s/base/` (deployment, service, configmap, hpa, ingress) and
  `k8s/overlays/{stag,prod}/` Kustomize manifests for `billing-service`,
  mirroring the shape `workshop-app` already uses and the naming
  `workshop-platform`'s `kubernetes/base/services/billing-service/`
  manifests already establish (service name, ConfigMap keys, container
  port 8080).
- Add `.github/workflows/deploy.yml`, built and pushed to ECR via OIDC,
  running database migrations, applied to the cluster via
  `kubectl kustomize` + `kubectl apply`, with a rollout status check and an
  HTTP smoke test — structurally identical to `workshop-app`'s deploy
  workflow, but **created disabled** for cost reasons: real AWS deploys
  stay off until a human explicitly turns it on.
- Add a `k8s` job to `.github/workflows/pr-validation.yml` that renders both
  overlays with `kubectl kustomize` (no cluster, no AWS calls) as a
  structural PR gate.

## Scope

**In scope:**
- Kubernetes base + overlay manifests for `billing-service`.
- Deploy and PR-validation workflow additions.

**Out of scope:**
- Actually deploying to AWS (the deploy workflow is disabled on merge).
- Provisioning the EKS cluster, RDS instance, or RabbitMQ broker (owned by
  `workshop-platform`).
- A full local `kind` cluster run of all three services (reserved as a
  separate, human-run validation step).
- Application code changes: this service's port handling already reads
  `PORT` from the environment correctly (unlike `workshop-execution`, which
  had a hardcoded-port bug fixed in a companion change), so no `src/`
  changes are needed here.
- Wiring real RabbitMQ or Postgres credentials (the ConfigMap ships safe,
  non-secret placeholder defaults; real values are injected at deploy time
  via `kubectl create secret`).

## Decision

Replicate `workshop-app`'s Kustomize base/overlay shape exactly, but name and
wire resources (`billing-service`, `billing-service-config`, container port
`8080`) to match `workshop-platform`'s existing shared ConfigMap and Service
definitions for this service, since that repository is the source of truth
for how `billing-service` is expected to be addressed inside the cluster
(e.g. `order-service`'s ConfigMap already resolves it at
`http://billing-service.stag.svc.cluster.local`). Because this service's
code already reads `PORT` from the environment (default `3000`), the new
ConfigMap sets `PORT: "8080"` directly — no source code change is required
to align with the platform's `8080` convention. The deploy workflow is added
but immediately disabled (`gh workflow disable`) so no real AWS resources
are touched by this change.

## Risks

- The deploy workflow has never been run for real, so its correctness beyond
  structural review and `kubectl kustomize` rendering is unverified until a
  human runs it (or a local `kind` cluster) after merge.
- `RABBITMQ_URL` in the ConfigMap is a non-secret placeholder host; real
  credentials must be supplied as repository/environment secrets before the
  workflow is ever enabled.
