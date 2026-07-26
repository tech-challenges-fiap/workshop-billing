## ADDED Requirements

### Requirement: Kubernetes deploy manifests

The Billing Service SHALL provide Kustomize base and overlay manifests
sufficient to deploy `billing-service` to the shared EKS cluster, named and
wired to match `workshop-platform`'s existing shared ConfigMap and Service
contract for this service.

#### Scenario: Base manifests render

- **GIVEN** `k8s/base/` containing `deployment.yaml`, `service.yaml`,
  `configmap.yaml`, `hpa.yaml`, `ingress.yaml`, and `kustomization.yaml`
- **WHEN** `kubectl kustomize k8s/base` is run
- **THEN** it renders a Deployment, Service, ConfigMap, HorizontalPodAutoscaler,
  and Ingress all named `billing-service`
- **AND** the Deployment's container listens on port `8080`

#### Scenario: Overlays render per environment

- **GIVEN** `k8s/overlays/stag/` and `k8s/overlays/prod/`, each referencing
  `../../base` and patching `runtime-config.yaml`, `ingress-patch.yaml`, and
  `hpa-patch.yaml` (`stag` additionally patches `replicas-patch.yaml`)
- **WHEN** `kubectl kustomize k8s/overlays/stag` and
  `kubectl kustomize k8s/overlays/prod` are run
- **THEN** both render without error
- **AND** each sets its namespace (`stag` or `prod`) and a distinct ingress host

#### Scenario: Prod keeps its HPA floor independent of stag's cost patch

- **GIVEN** `k8s/base/hpa.yaml` declares `minReplicas: 2` and
  `k8s/overlays/stag/hpa-patch.yaml` patches it down to `1`
- **WHEN** `kubectl kustomize k8s/overlays/prod` is run
- **THEN** the rendered HorizontalPodAutoscaler has `minReplicas: 2`
  (`k8s/overlays/prod/hpa-patch.yaml` pins it explicitly, so a future edit to
  the base value cannot silently reduce prod's floor)
- **AND** `kubectl kustomize k8s/overlays/stag` renders `minReplicas: 1`

### Requirement: Dormant deploy workflow

The Billing Service SHALL provide a `Deploy` GitHub Actions workflow
structurally equivalent to `workshop-app`'s (build, push to ECR via OIDC,
configure `kubectl`, apply the target overlay, wait for rollout, smoke-test
`/health`), and that workflow SHALL remain dormant — both by trigger design
and by being disabled after creation — so no real AWS deploy happens as a
side effect of adding it.

#### Scenario: Workflow triggers only on manual dispatch with an explicit target

- **GIVEN** `.github/workflows/deploy.yml`
- **WHEN** inspecting its `on:` triggers
- **THEN** it triggers only on `workflow_dispatch` with a required
  `environment` choice input (`stag` or `prod`) — it deliberately has no
  `push` trigger, because merging this change is itself a push to `stag`,
  and `gh workflow disable` cannot run until after that merge; without a
  `push` trigger, that merge cannot start a real deploy
- **AND** it requests `id-token: write` permission for AWS OIDC and no
  static AWS credentials are stored in the repository
- **AND** the job resolves and validates the requested target in its first
  step, aborting before any AWS or `kubectl` action if it is not exactly
  `stag` or `prod`
- **AND** the job-level `environment:` name expression has no unmatched
  fallback to `production` — an unrecognized target resolves to an empty
  environment name rather than silently selecting production

#### Scenario: Database URL is safe to construct from arbitrary credentials

- **GIVEN** `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` secret
  values that may contain URI-reserved characters (`:`, `/`, `@`, `?`, `#`)
- **WHEN** the "Run database migrations" and "Apply runtime secret" steps
  build the `postgres://` connection URI
- **THEN** each of those three components is percent-encoded before being
  interpolated into the URI, so the resulting `DATABASE_URL` is a valid URI
  regardless of the raw characters in the credentials

#### Scenario: Workflow is disabled after creation

- **GIVEN** the `Deploy` workflow exists on the repository
- **WHEN** `gh workflow disable Deploy` is run against the repository
- **THEN** the workflow is marked disabled as defense-in-depth, matching
  `workshop-app`'s dormant deploy workflow

### Requirement: PR-validation Kubernetes render check

The Billing Service SHALL validate its Kubernetes manifests on every pull
request using only local rendering, with no cluster access and no AWS calls.

#### Scenario: k8s job renders both overlays

- **GIVEN** the `k8s` job in `.github/workflows/pr-validation.yml`
- **WHEN** a pull request targeting `stag` or `prod` is opened or updated
- **THEN** the job runs `kubectl kustomize k8s/overlays/stag` and
  `kubectl kustomize k8s/overlays/prod`
- **AND** the job fails if either overlay fails to render
- **AND** the job does not configure AWS credentials or contact a cluster
