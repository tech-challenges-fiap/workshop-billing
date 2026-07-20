import { describe, expect, it } from "bun:test";
import type {
  BillingRecord,
  BillingRecordStatus,
  PaymentAttempt,
  PaymentAttemptStatus,
} from "../repositories/billing";
import {
  EnvelopeValidationError,
  createBillingEnvelope,
  parseEnvelope,
  serializeEnvelope,
} from "./envelope";
import {
  BillingMessageHandler,
  type MessagePublisher,
  PAYMENT_AUTHORIZE_REQUESTED,
  PAYMENT_CANCEL_REQUESTED,
  PAYMENT_COMPENSATION_COMPLETED,
  PAYMENT_STATUS_CHANGED,
} from "./handlers";

const now = new Date("2026-07-19T12:00:00.000Z");
const billingRecord: BillingRecord = {
  id: "billing-1",
  orderId: "order-1",
  customerId: "customer-1",
  amountCents: 4200,
  currency: "BRL",
  status: "pending",
  idempotencyKey: "idem-1",
  correlationId: "corr-1",
  createdAt: now,
  updatedAt: now,
};
const paymentAttempt: PaymentAttempt = {
  id: "attempt-1",
  billingRecordId: "billing-1",
  status: "pending",
  provider: null,
  providerReference: null,
  idempotencyKey: "idem-1",
  correlationId: "corr-1",
  metadata: {},
  createdAt: now,
  updatedAt: now,
};

class FakeBillingRepository {
  created: Array<Record<string, unknown>> = [];
  updates: Array<{ id: string; status: BillingRecordStatus }> = [];

  constructor(
    private recordById: BillingRecord | null = null,
    private recordByOrderId: BillingRecord | null = null,
    private recordByIdempotencyKey: BillingRecord | null = null,
  ) {}

  async create(input: Record<string, unknown>): Promise<BillingRecord> {
    this.created.push(input);
    this.recordById = { ...billingRecord, ...input } as BillingRecord;
    return this.recordById;
  }

  async findById(): Promise<BillingRecord | null> {
    return this.recordById;
  }

  async findByOrderId(): Promise<BillingRecord | null> {
    return this.recordByOrderId;
  }

  async findByIdempotencyKey(): Promise<BillingRecord | null> {
    return this.recordByIdempotencyKey;
  }

  async updateStatus(id: string, status: BillingRecordStatus): Promise<BillingRecord | null> {
    this.updates.push({ id, status });
    if (!this.recordById) {
      this.recordById = { ...billingRecord, id, status };
    } else {
      this.recordById = { ...this.recordById, status };
    }
    return this.recordById;
  }
}

class FakePaymentAttemptRepository {
  created: Array<Record<string, unknown>> = [];
  updates: Array<{ id: string; status: PaymentAttemptStatus }> = [];

  constructor(
    private attemptById: PaymentAttempt | null = null,
    private attemptByIdempotencyKey: PaymentAttempt | null = null,
    private attemptsByBillingRecordId: PaymentAttempt[] = [],
  ) {}

  async create(input: Record<string, unknown>): Promise<PaymentAttempt> {
    this.created.push(input);
    this.attemptById = { ...paymentAttempt, ...input } as PaymentAttempt;
    return this.attemptById;
  }

  async findById(): Promise<PaymentAttempt | null> {
    return this.attemptById;
  }

  async findByIdempotencyKey(): Promise<PaymentAttempt | null> {
    return this.attemptByIdempotencyKey;
  }

  async listByBillingRecordId(): Promise<PaymentAttempt[]> {
    return this.attemptsByBillingRecordId;
  }

  async updateStatus(id: string, status: PaymentAttemptStatus): Promise<PaymentAttempt | null> {
    this.updates.push({ id, status });
    const updated = { ...(this.attemptById ?? paymentAttempt), id, status };
    this.attemptById = updated;
    return updated;
  }
}

class FakePublisher implements MessagePublisher {
  published: Array<{ routingKey: string; envelope: ReturnType<typeof createBillingEnvelope> }> = [];

  async publish(
    routingKey: string,
    envelope: ReturnType<typeof createBillingEnvelope>,
  ): Promise<void> {
    this.published.push({ routingKey, envelope });
  }
}

function authorizationEnvelope() {
  return createBillingEnvelope({
    eventId: "event-1",
    type: PAYMENT_AUTHORIZE_REQUESTED,
    correlationId: "corr-1",
    occurredAt: now,
    payload: {
      orderId: "order-1",
      customerId: "customer-1",
      amountCents: 4200,
      currency: "brl",
      idempotencyKey: "idem-1",
    },
  });
}

describe("message envelopes", () => {
  it("serializes and parses required metadata", () => {
    const envelope = authorizationEnvelope();

    expect(parseEnvelope(serializeEnvelope(envelope))).toEqual(envelope);
  });

  it("rejects malformed or incomplete messages", () => {
    expect(() => parseEnvelope(Buffer.from("not-json"))).toThrow(EnvelopeValidationError);
    expect(() =>
      parseEnvelope(Buffer.from(JSON.stringify({ ...authorizationEnvelope(), eventId: "" }))),
    ).toThrow("eventId must be a non-empty string");
  });
});

describe("BillingMessageHandler", () => {
  it("creates processing billing state and publishes a status event", async () => {
    const billingRepository = new FakeBillingRepository();
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const publisher = new FakePublisher();
    const handler = new BillingMessageHandler({
      billingRepository,
      paymentAttemptRepository,
      publisher,
    });

    await handler.handle(authorizationEnvelope());

    expect(billingRepository.created).toEqual([
      {
        orderId: "order-1",
        customerId: "customer-1",
        amountCents: 4200,
        currency: "BRL",
        idempotencyKey: "idem-1",
        correlationId: "corr-1",
        status: "processing",
      },
    ]);
    expect(paymentAttemptRepository.created).toMatchObject([
      { billingRecordId: "billing-1", status: "processing", idempotencyKey: "idem-1" },
    ]);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]).toMatchObject({
      routingKey: PAYMENT_STATUS_CHANGED,
      envelope: {
        correlationId: "corr-1",
        type: PAYMENT_STATUS_CHANGED,
        payload: {
          billingRecordId: "billing-1",
          orderId: "order-1",
          paymentAttemptId: "attempt-1",
          billingStatus: "processing",
          paymentStatus: "processing",
        },
      },
    });
  });

  it("replays authorization by idempotency key without duplicate writes", async () => {
    const billingRepository = new FakeBillingRepository(billingRecord, null, billingRecord);
    const paymentAttemptRepository = new FakePaymentAttemptRepository(null, {
      ...paymentAttempt,
      status: "processing",
    });
    const publisher = new FakePublisher();
    const handler = new BillingMessageHandler({
      billingRepository,
      paymentAttemptRepository,
      publisher,
    });

    await handler.handle(authorizationEnvelope());

    expect(billingRepository.created).toEqual([]);
    expect(paymentAttemptRepository.created).toEqual([]);
    expect(publisher.published[0].routingKey).toBe(PAYMENT_STATUS_CHANGED);
  });

  it("cancels existing billing state and publishes compensation completion", async () => {
    const billingRepository = new FakeBillingRepository(billingRecord);
    const paymentAttemptRepository = new FakePaymentAttemptRepository(paymentAttempt, null, [
      paymentAttempt,
    ]);
    const publisher = new FakePublisher();
    const handler = new BillingMessageHandler({
      billingRepository,
      paymentAttemptRepository,
      publisher,
    });

    await handler.handle(
      createBillingEnvelope({
        eventId: "event-cancel-1",
        type: PAYMENT_CANCEL_REQUESTED,
        correlationId: "corr-1",
        occurredAt: now,
        payload: { billingRecordId: "billing-1", reason: "order_failed" },
      }),
    );

    expect(billingRepository.updates).toEqual([{ id: "billing-1", status: "canceled" }]);
    expect(paymentAttemptRepository.updates).toEqual([{ id: "attempt-1", status: "canceled" }]);
    expect(publisher.published[0]).toMatchObject({
      routingKey: PAYMENT_COMPENSATION_COMPLETED,
      envelope: {
        correlationId: "corr-1",
        payload: {
          result: "completed",
          requestType: PAYMENT_CANCEL_REQUESTED,
          billingRecordId: "billing-1",
          orderId: "order-1",
          paymentAttemptId: "attempt-1",
        },
      },
    });
  });

  it("publishes noop compensation result for missing billing records", async () => {
    const publisher = new FakePublisher();
    const handler = new BillingMessageHandler({
      billingRepository: new FakeBillingRepository(),
      paymentAttemptRepository: new FakePaymentAttemptRepository(),
      publisher,
    });

    await handler.handle(
      createBillingEnvelope({
        eventId: "event-cancel-2",
        type: PAYMENT_CANCEL_REQUESTED,
        correlationId: "corr-2",
        occurredAt: now,
        payload: { orderId: "missing-order" },
      }),
    );

    expect(publisher.published[0]).toMatchObject({
      routingKey: PAYMENT_COMPENSATION_COMPLETED,
      envelope: {
        correlationId: "corr-2",
        payload: { result: "noop", orderId: "missing-order" },
      },
    });
  });
});
