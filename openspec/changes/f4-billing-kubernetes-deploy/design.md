# f4-billing-kubernetes-deploy — Design

## Manifest shape

`k8s/base/` follows the same five-manifest Kustomize shape `workshop-app`
uses (`deployment.yaml`, `service.yaml`, `configmap.yaml`, `hpa.yaml`,
`ingress.yaml`, `kustomization.yaml`). Resource names, labels, and the
container port are taken from `workshop-platform`'s
`kubernetes/base/services/billing-service/` manifests rather than copied
from `workshop-app`, because those manifests are the contract other
in-cluster services already depend on:

- Deployment/Service name: `billing-service` (matches
  `order-service-config`'s `BILLING_SERVICE_URL:
  http://billing-service.stag.svc.cluster.local`).
- Labels: `app.kubernetes.io/name: billing-service`,
  `app.kubernetes.io/component: api`,
  `app.kubernetes.io/part-of: workshop-phase-4`.
- Container port: `8080` (named `http`), Service `port: 80 -> targetPort:
  http`, matching `workshop-platform`'s `HTTP_PORT: "8080"` convention so
  `http://billing-service...` (no port) resolves correctly.
- ConfigMap name: `billing-service-config`, carrying `SERVICE_NAME`, `PORT`,
  `RABBITMQ_URL`, `RABBITMQ_CONSUMERS_ENABLED` (plural — matching this
  service's own `src/config/env.ts` variable name; `workshop-execution`'s
  equivalent variable is singular, so the two are intentionally not
  identical).

This service's `src/config/env.ts` already reads `PORT` (not `HTTP_PORT`)
from the environment, defaulting to `3000`. Rather than changing application
code to introduce an `HTTP_PORT` reader (as was necessary for
`workshop-execution`, which had a hardcoded, unconfigurable port), the new
ConfigMap simply sets `PORT: "8080"` directly. This achieves the same
platform-wide port convention (`8080`) without any `src/` changes, since the
existing code already honors `PORT` correctly.

Overlays (`stag`, `prod`) patch `APP_ENV` and the ingress host; `stag`
additionally scales the base replica count down from 2 to 1, mirroring
`workshop-app`'s cost-conscious `stag` pattern.

Secrets (`DATABASE_URL`, assembled from `POSTGRES_*` GitHub Actions secrets)
are never committed; the deploy workflow creates/updates a
`billing-service-secret` Kubernetes Secret immediately before applying the
overlay, the same pattern `workshop-app`'s deploy workflow uses for its own
Postgres/JWT secret.

## Deploy workflow — dormant by design

`.github/workflows/deploy.yml` is structurally identical in shape to
`workshop-app`'s: build the app, build+push a container image to ECR via
OIDC (`id-token: write`, no static AWS credentials), configure `kubectl`
against the shared EKS cluster, run this service's own `bun run migrate`
against the target database, apply a Kubernetes Secret built from GitHub
Actions secrets, render+apply the target overlay, wait for rollout, and
smoke-test `GET /health` through a port-forward. It triggers on push to
`stag`/`prod` and `workflow_dispatch`, exactly like `workshop-app`'s, but is
disabled immediately after creation via `gh workflow disable Deploy` so no
real AWS spend happens as a side effect of this change landing.

## PR validation

The new `k8s` job in `pr-validation.yml` only runs `kubectl kustomize` against
both overlays — no cluster, no AWS credentials, no network calls — so every
PR gets a structural guarantee that the manifests are valid Kustomize
without any deploy-time cost or risk.
