import { describe, expect, it } from "bun:test";
import type { QueryResult, QueryResultRow } from "pg";
import type { Queryable } from "../database/postgres";
import {
  BillingRepository,
  PaymentAttemptRepository,
  billingStatusForAttemptStatus,
} from "./billing";

type RecordedQuery = {
  text: string;
  values?: readonly unknown[];
};

class FakeDb implements Queryable {
  queries: RecordedQuery[] = [];

  constructor(private readonly rows: QueryResultRow[] = []) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>> {
    this.queries.push({ text, values });
    return { rows: this.rows as T[] } as unknown as QueryResult<T>;
  }
}

const billingRow = {
  id: "6e54b0cc-c966-4573-87c5-90a57d2a641d",
  order_id: "order-123",
  customer_id: "customer-456",
  amount_cents: 2590,
  currency: "BRL",
  status: "pending",
  idempotency_key: "bill-idem-1",
  correlation_id: "corr-1",
  created_at: new Date("2026-07-17T10:00:00.000Z"),
  updated_at: new Date("2026-07-17T10:00:00.000Z"),
};

const paymentAttemptRow = {
  id: "7cdb4eda-c0b8-45dc-8375-f6f4d9c00d22",
  billing_record_id: billingRow.id,
  status: "processing",
  provider: "example-provider",
  provider_reference: "provider-ref-1",
  idempotency_key: "pay-idem-1",
  correlation_id: "corr-1",
  metadata: { correlationId: "corr-1" },
  created_at: new Date("2026-07-17T10:01:00.000Z"),
  updated_at: new Date("2026-07-17T10:01:00.000Z"),
};

describe("BillingRepository", () => {
  it("creates a billing record with parameterized SQL and maps the row", async () => {
    const db = new FakeDb([billingRow]);
    const repository = new BillingRepository(db);

    const record = await repository.create({
      orderId: "order-123",
      customerId: "customer-456",
      amountCents: 2590,
      currency: "brl",
      idempotencyKey: "bill-idem-1",
      correlationId: "corr-1",
    });

    expect(record).toEqual({
      id: billingRow.id,
      orderId: "order-123",
      customerId: "customer-456",
      amountCents: 2590,
      currency: "BRL",
      status: "pending",
      idempotencyKey: "bill-idem-1",
      correlationId: "corr-1",
      createdAt: billingRow.created_at,
      updatedAt: billingRow.updated_at,
    });
    expect(db.queries[0].text).toContain("INSERT INTO billing_records");
    expect(db.queries[0].values).toEqual([
      "order-123",
      "customer-456",
      2590,
      "BRL",
      "pending",
      "bill-idem-1",
      "corr-1",
    ]);
  });

  it("finds billing records by order id", async () => {
    const db = new FakeDb([billingRow]);
    const repository = new BillingRepository(db);

    await expect(repository.findByOrderId("order-123")).resolves.toMatchObject({
      id: billingRow.id,
      orderId: "order-123",
    });
    expect(db.queries[0]).toEqual({
      text: "SELECT * FROM billing_records WHERE order_id = $1",
      values: ["order-123"],
    });
  });

  it("finds billing records by idempotency key", async () => {
    const db = new FakeDb([billingRow]);
    const repository = new BillingRepository(db);

    await expect(repository.findByIdempotencyKey("bill-idem-1")).resolves.toMatchObject({
      id: billingRow.id,
      idempotencyKey: "bill-idem-1",
    });
    expect(db.queries[0]).toEqual({
      text: "SELECT * FROM billing_records WHERE idempotency_key = $1",
      values: ["bill-idem-1"],
    });
  });

  it("returns null when a record is not found", async () => {
    const repository = new BillingRepository(new FakeDb());

    await expect(repository.findById("missing-id")).resolves.toBeNull();
  });

  it("updates status with a parameterized update", async () => {
    const db = new FakeDb([{ ...billingRow, status: "paid" }]);
    const repository = new BillingRepository(db);

    await expect(repository.updateStatus(billingRow.id, "paid")).resolves.toMatchObject({
      status: "paid",
    });
    expect(db.queries[0].text).toContain("UPDATE billing_records");
    expect(db.queries[0].values).toEqual([billingRow.id, "paid"]);
  });

  it("lists billing records by customer id", async () => {
    const db = new FakeDb([billingRow]);
    const repository = new BillingRepository(db);

    await expect(repository.listByCustomerId("customer-456")).resolves.toHaveLength(1);
    expect(db.queries[0].text).toContain("WHERE customer_id = $1");
    expect(db.queries[0].values).toEqual(["customer-456"]);
  });
});

describe("PaymentAttemptRepository", () => {
  it("records a payment attempt with gateway-agnostic metadata", async () => {
    const db = new FakeDb([paymentAttemptRow]);
    const repository = new PaymentAttemptRepository(db);

    const attempt = await repository.create({
      billingRecordId: billingRow.id,
      status: "processing",
      provider: "example-provider",
      providerReference: "provider-ref-1",
      idempotencyKey: "pay-idem-1",
      correlationId: "corr-1",
      metadata: { correlationId: "corr-1" },
    });

    expect(attempt).toEqual({
      id: paymentAttemptRow.id,
      billingRecordId: billingRow.id,
      status: "processing",
      provider: "example-provider",
      providerReference: "provider-ref-1",
      idempotencyKey: "pay-idem-1",
      correlationId: "corr-1",
      metadata: { correlationId: "corr-1" },
      createdAt: paymentAttemptRow.created_at,
      updatedAt: paymentAttemptRow.updated_at,
    });
    expect(db.queries[0].text).toContain("INSERT INTO payment_attempts");
    expect(db.queries[0].values).toEqual([
      billingRow.id,
      "processing",
      "example-provider",
      "provider-ref-1",
      "pay-idem-1",
      "corr-1",
      JSON.stringify({ correlationId: "corr-1" }),
    ]);
  });

  it("lists payment attempts for a billing record", async () => {
    const db = new FakeDb([paymentAttemptRow]);
    const repository = new PaymentAttemptRepository(db);

    await expect(repository.listByBillingRecordId(billingRow.id)).resolves.toHaveLength(1);
    expect(db.queries[0].text).toContain("WHERE billing_record_id = $1");
    expect(db.queries[0].values).toEqual([billingRow.id]);
  });

  it("finds payment attempts by id", async () => {
    const db = new FakeDb([paymentAttemptRow]);
    const repository = new PaymentAttemptRepository(db);

    await expect(repository.findById(paymentAttemptRow.id)).resolves.toMatchObject({
      id: paymentAttemptRow.id,
    });
    expect(db.queries[0]).toEqual({
      text: "SELECT * FROM payment_attempts WHERE id = $1",
      values: [paymentAttemptRow.id],
    });
  });

  it("finds payment attempts by idempotency key", async () => {
    const db = new FakeDb([paymentAttemptRow]);
    const repository = new PaymentAttemptRepository(db);

    await expect(repository.findByIdempotencyKey("pay-idem-1")).resolves.toMatchObject({
      id: paymentAttemptRow.id,
      idempotencyKey: "pay-idem-1",
    });
    expect(db.queries[0]).toEqual({
      text: "SELECT * FROM payment_attempts WHERE idempotency_key = $1",
      values: ["pay-idem-1"],
    });
  });

  it("updates payment attempt status", async () => {
    const db = new FakeDb([{ ...paymentAttemptRow, status: "succeeded" }]);
    const repository = new PaymentAttemptRepository(db);

    await expect(repository.updateStatus(paymentAttemptRow.id, "succeeded")).resolves.toMatchObject(
      {
        status: "succeeded",
      },
    );
    expect(db.queries[0].text).toContain("UPDATE payment_attempts");
    expect(db.queries[0].values).toEqual([paymentAttemptRow.id, "succeeded"]);
  });
});

describe("billingStatusForAttemptStatus", () => {
  it("maps gateway-agnostic attempt states to billing states", () => {
    expect(billingStatusForAttemptStatus("pending")).toBe("pending");
    expect(billingStatusForAttemptStatus("processing")).toBe("processing");
    expect(billingStatusForAttemptStatus("succeeded")).toBe("paid");
    expect(billingStatusForAttemptStatus("failed")).toBe("failed");
    expect(billingStatusForAttemptStatus("canceled")).toBe("canceled");
  });
});
