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
`workshop-app`'s cost-conscious `stag` pattern. `k8s/base/hpa.yaml`'s
`minReplicas` is `2` (prod's floor); `stag/hpa-patch.yaml` patches it down to
`1` for the same cost reason, and `prod/hpa-patch.yaml` explicitly re-pins it
to `2` so that a later edit to the shared base value cannot silently reduce
prod's floor by way of prod simply inheriting whatever base says.

Secrets (`DATABASE_URL`, assembled from `POSTGRES_*` GitHub Actions secrets)
are never committed; the deploy workflow creates/updates a
`billing-service-secret` Kubernetes Secret immediately before applying the
overlay, the same pattern `workshop-app`'s deploy workflow uses for its own
Postgres/JWT secret. Because the raw secret values (in particular the
generated password) may legally contain URI-reserved characters, the
workflow percent-encodes the user, password, and database components with
`jq -rn --arg v "$value" '$v | @uri'` before interpolating them into the
`postgres://` connection string, both when running migrations and when
writing the runtime Secret — an un-encoded interpolation would silently
corrupt the URI (and therefore the connection) for any credential containing
`:`, `/`, `@`, `?`, or `#`.

## Deploy workflow — dormant by design and by trigger

`.github/workflows/deploy.yml` is structurally close to `workshop-app`'s:
build the app, build+push a container image to ECR via OIDC
(`id-token: write`, no static AWS credentials), configure `kubectl` against
the shared EKS cluster, run this service's own `bun run migrate` against the
target database, apply a Kubernetes Secret built from GitHub Actions
secrets, render+apply the target overlay, wait for rollout, and smoke-test
`GET /health` through a port-forward.

Unlike `workshop-app`'s deploy workflow, this one deliberately has **no
`push` trigger** — only `workflow_dispatch` with a required `environment`
choice input (`stag` or `prod`). Merging this change is itself a push to
`stag`, and `gh workflow disable Deploy` cannot be run until after the
workflow file exists on the default branch (i.e. after that same merge). A
`push`-triggered deploy workflow would therefore have a real chance of
running an actual AWS deploy off the merge commit before a human ever gets
the chance to disable it. Dropping the `push` trigger closes that window
entirely: the workflow cannot run until a human explicitly dispatches it,
regardless of whether `gh workflow disable` has been run yet. It is still
disabled via `gh workflow disable Deploy` immediately after merge as an
additional layer of defense.

The job's first step resolves and validates the requested target
(`inputs.environment`) before anything else runs, failing the job with
`exit 1` if it is not exactly `stag` or `prod`, and only then exports
`DEPLOY_TARGET`/`DEPLOY_NAMESPACE` via `$GITHUB_ENV` for later steps to
consume. The job-level `environment:` name is computed the same way, but
without an unmatched `||` fallback: an unrecognized `inputs.environment`
resolves to an empty string rather than silently selecting `production`, so
a malformed manual dispatch cannot be routed to prod by default.

## PR validation

The new `k8s` job in `pr-validation.yml` only runs `kubectl kustomize` against
both overlays — no cluster, no AWS credentials, no network calls — so every
PR gets a structural guarantee that the manifests are valid Kustomize
without any deploy-time cost or risk.
