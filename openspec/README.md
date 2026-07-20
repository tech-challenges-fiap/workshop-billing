# OpenSpec Governance

This directory contains the specification and change governance for the Billing Service.

## What is OpenSpec?

OpenSpec is a lightweight RFC-style process. Before any non-trivial change lands in this service, a proposal must be written, reviewed, and approved.

## Structure

```
openspec/
└── changes/
    └── <change-id>/
        ├── proposal.md   — what, why, scope, decision
        ├── tasks.md      — implementation task list
        └── design.md     — optional deeper design notes
```

## Change IDs

Format: `f<phase>-<short-slug>`, e.g. `f4-billing-service-scaffold`.

## Process

1. Create `openspec/changes/<id>/proposal.md` with status `Draft`.
2. Discuss and iterate. Update status to `Accepted` when approved.
3. Implement. Update task checkboxes as work progresses.
4. Mark proposal `Done` when all tasks are complete and merged.

## Statuses

| Status | Meaning |
|---|---|
| Draft | Under discussion |
| Accepted | Approved, implementation may begin |
| Done | All tasks complete and merged |
| Withdrawn | Cancelled or superseded |
