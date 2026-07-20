# f4-billing-rabbitmq-compensation — Proposal

**Status:** Done  
**Author:** Phase 4 Team  
**Date:** 2026-07-19

## Why

The distributed order saga needs the Billing Service to consume payment authorization and compensation intents over RabbitMQ and publish gateway-agnostic billing outcomes without sharing databases or gateway-specific models. This foundation must provide retry-safe event handling, stable envelopes, and Billing-owned state transitions while leaving the full OS distributed saga flow to a later change.

## What Changes

Add RabbitMQ messaging and compensation foundations for:

- Runtime configuration of the broker URL, exchange, queues, routing keys, and consumer enablement.
- A stable event envelope with `eventId`, `correlationId`, `schemaVersion`, `producer`, `type`, `occurredAt`, and `payload`.
- Inbound handlers for payment authorization requests and compensation/cancel/refund intents using only Billing-owned repositories.
- Outbound payment status and compensation result events through a broker-agnostic publisher interface.
- Idempotent command/event processing based on envelope event ids or payload idempotency keys.

## Scope

**In scope:**
- Internal RabbitMQ configuration and optional runtime consumer bootstrap.
- Envelope parsing/serialization and validation tests.
- Billing-owned command handlers that create/replay billing records and payment attempts, update statuses, and publish outcome events.
- Compensation intent handling that cancels Billing-owned records/attempts and emits result events.
- Unit tests using in-memory publishers/repositories; no live broker requirement.

**Out of scope:**
- Implementing the OS distributed saga/orchestration flow.
- Payment gateway authorization, capture, refund SDK calls, or provider-specific behavior.
- Direct reads/writes to Order Service, Execution Service, or other service databases.
- Requiring a live RabbitMQ broker during tests.

## Decision

Keep messaging concerns behind Billing-owned envelope, publisher, and handler modules. Runtime RabbitMQ startup is opt-in via environment configuration, while unit tests exercise handlers without a broker. Idempotency is enforced before writes and before publishing derived events so broker retries do not create duplicate Billing-owned records.

## Risks

- The runtime RabbitMQ adapter is smoke-tested through unit boundaries only because CI does not provide a broker.
- Future saga work may rename routing keys, but the envelope and handler boundaries are intentionally explicit and versioned.
