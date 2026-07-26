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
  `../../base` and patching `runtime-config.yaml` and `ingress-patch.yaml`
  (`stag` additionally patches `replicas-patch.yaml`)
- **WHEN** `kubectl kustomize k8s/overlays/stag` and
  `kubectl kustomize k8s/overlays/prod` are run
- **THEN** both render without error
- **AND** each sets its namespace (`stag` or `prod`) and a distinct ingress host

### Requirement: Dormant deploy workflow

The Billing Service SHALL provide a `Deploy` GitHub Actions workflow
structurally equivalent to `workshop-app`'s (build, push to ECR via OIDC,
configure `kubectl`, apply the target overlay, wait for rollout, smoke-test
`/health`), and that workflow SHALL remain disabled after creation so no
real AWS deploy happens as a side effect of adding it.

#### Scenario: Workflow triggers match workshop-app's pattern

- **GIVEN** `.github/workflows/deploy.yml`
- **WHEN** inspecting its `on:` triggers
- **THEN** it triggers on push to `stag` and `prod` and on `workflow_dispatch`
- **AND** it requests `id-token: write` permission for AWS OIDC and no
  static AWS credentials are stored in the repository

#### Scenario: Workflow is disabled after creation

- **GIVEN** the `Deploy` workflow exists on the repository
- **WHEN** `gh workflow disable Deploy` is run against the repository
- **THEN** the workflow is marked disabled and will not run on push,
  matching `workshop-app`'s dormant deploy workflow

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
