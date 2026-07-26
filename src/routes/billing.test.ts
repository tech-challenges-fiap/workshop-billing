import { describe, expect, it } from "bun:test";
import type {
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentGateway,
  PaymentStatusResult,
} from "../gateways/payment-gateway";
import type {
  BillingRecord,
  BillingRecordStatus,
  PaymentAttempt,
  PaymentAttemptStatus,
} from "../repositories/billing";
import {
  type BillingRecordReaderWriter,
  type PaymentAttemptReaderWriter,
  createBillingRoutes,
} from "./billing";

const now = new Date("2026-07-19T12:00:00.000Z");
const billingRecord: BillingRecord = {
  id: "6e54b0cc-c966-4573-87c5-90a57d2a641d",
  orderId: "order-123",
  customerId: "customer-456",
  amountCents: 2590,
  currency: "BRL",
  status: "pending",
  idempotencyKey: "bill-idem-1",
  correlationId: "corr-1",
  createdAt: now,
  updatedAt: now,
};
const paymentAttempt: PaymentAttempt = {
  id: "7cdb4eda-c0b8-45dc-8375-f6f4d9c00d22",
  billingRecordId: billingRecord.id,
  status: "pending",
  provider: "provider-a",
  providerReference: "provider-ref-1",
  idempotencyKey: "pay-idem-1",
  correlationId: "corr-1",
  metadata: { checkoutId: "checkout-1" },
  createdAt: now,
  updatedAt: now,
};

class FakeBillingRepository implements BillingRecordReaderWriter {
  created: Parameters<BillingRecordReaderWriter["create"]>[0][] = [];
  updates: Array<{ id: string; status: BillingRecordStatus }> = [];

  constructor(
    private recordById: BillingRecord | null = billingRecord,
    private recordByIdempotencyKey: BillingRecord | null = null,
  ) {}

  async create(input: Parameters<BillingRecordReaderWriter["create"]>[0]): Promise<BillingRecord> {
    this.created.push(input);
    return {
      ...billingRecord,
      ...input,
      currency: input.currency.toUpperCase(),
    };
  }

  async findById(): Promise<BillingRecord | null> {
    return this.recordById;
  }

  async findByIdempotencyKey(): Promise<BillingRecord | null> {
    return this.recordByIdempotencyKey;
  }

  async updateStatus(id: string, status: BillingRecordStatus): Promise<BillingRecord | null> {
    this.updates.push({ id, status });
    if (!this.recordById) {
      return null;
    }
    this.recordById = { ...this.recordById, status };
    return this.recordById;
  }
}

class FakePaymentAttemptRepository implements PaymentAttemptReaderWriter {
  created: Parameters<PaymentAttemptReaderWriter["create"]>[0][] = [];
  updates: Array<{ id: string; status: PaymentAttemptStatus }> = [];

  constructor(
    private attemptById: PaymentAttempt | null = paymentAttempt,
    private attemptByIdempotencyKey: PaymentAttempt | null = null,
  ) {}

  async create(
    input: Parameters<PaymentAttemptReaderWriter["create"]>[0],
  ): Promise<PaymentAttempt> {
    this.created.push(input);
    return {
      ...paymentAttempt,
      ...input,
      provider: input.provider ?? null,
      providerReference: input.providerReference ?? null,
      status: input.status ?? "pending",
      metadata: input.metadata ?? {},
    };
  }

  async findById(): Promise<PaymentAttempt | null> {
    return this.attemptById;
  }

  async findByIdempotencyKey(): Promise<PaymentAttempt | null> {
    return this.attemptByIdempotencyKey;
  }

  async updateStatus(id: string, status: PaymentAttemptStatus): Promise<PaymentAttempt | null> {
    this.updates.push({ id, status });
    if (!this.attemptById) {
      return null;
    }
    this.attemptById = { ...this.attemptById, status };
    return this.attemptById;
  }
}

/**
 * Hand-rolled `PaymentGateway` test double (no mocking library, matching this
 * repo's existing fake-repository style) so route wiring can be exercised for
 * a successful charge, a failed charge, and a webhook-driven status query
 * without needing real Mercado Pago credentials.
 */
class FakePaymentGateway implements PaymentGateway {
  readonly provider = "mercadopago";
  chargeCalls: PaymentChargeInput[] = [];
  statusCalls: string[] = [];

  constructor(
    private chargeResult: PaymentChargeResult | Error = {
      providerReference: "mp-ref-1",
      status: "succeeded",
      raw: { id: "mp-ref-1", status: "approved" },
    },
    private statusResult: PaymentStatusResult | Error = {
      providerReference: "mp-ref-1",
      status: "succeeded",
      raw: { id: "mp-ref-1", status: "approved" },
    },
  ) {}

  async charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    this.chargeCalls.push(input);
    if (this.chargeResult instanceof Error) {
      throw this.chargeResult;
    }
    return this.chargeResult;
  }

  async getStatus(providerReference: string): Promise<PaymentStatusResult> {
    this.statusCalls.push(providerReference);
    if (this.statusResult instanceof Error) {
      throw this.statusResult;
    }
    return this.statusResult;
  }
}

describe("billing payment contract routes", () => {
  it("creates a billing record with idempotency and correlation contracts", async () => {
    const billingRepository = new FakeBillingRepository();
    const app = createBillingRoutes({ billingRepository });

    const response = await app.request("/billing-records", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-123",
        customerId: "customer-456",
        amountCents: 2590,
        currency: "brl",
        idempotencyKey: "bill-idem-1",
        correlationId: "corr-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      idempotentReplay: false,
      billingRecord: {
        orderId: "order-123",
        currency: "BRL",
        idempotencyKey: "bill-idem-1",
        correlationId: "corr-1",
      },
    });
    expect(billingRepository.created).toEqual([
      {
        orderId: "order-123",
        customerId: "customer-456",
        amountCents: 2590,
        currency: "BRL",
        idempotencyKey: "bill-idem-1",
        correlationId: "corr-1",
      },
    ]);
  });

  it("replays an existing billing record by idempotency key", async () => {
    const billingRepository = new FakeBillingRepository(billingRecord, billingRecord);
    const app = createBillingRoutes({ billingRepository });

    const response = await app.request("/billing-records", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-123",
        customerId: "customer-456",
        amountCents: 2590,
        currency: "BRL",
        idempotencyKey: "bill-idem-1",
        correlationId: "corr-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ idempotentReplay: true });
    expect(billingRepository.created).toEqual([]);
  });

  it("rejects invalid billing creation requests before writing", async () => {
    const billingRepository = new FakeBillingRepository();
    const app = createBillingRoutes({ billingRepository });

    const response = await app.request("/billing-records", {
      method: "POST",
      body: JSON.stringify({ orderId: "", amountCents: -1, currency: "BRL" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "validation_error" },
    });
    expect(billingRepository.created).toEqual([]);
  });

  it("returns a quote for an existing billing record", async () => {
    const app = createBillingRoutes({ billingRepository: new FakeBillingRepository() });

    const response = await app.request(`/billing-records/${billingRecord.id}/quote`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      quote: {
        billingRecordId: billingRecord.id,
        orderId: "order-123",
        customerId: "customer-456",
        amountCents: 2590,
        currency: "BRL",
        status: "pending",
        canAttemptPayment: true,
        correlationId: "corr-1",
      },
    });
  });

  it("creates a gateway-agnostic payment attempt", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const app = createBillingRoutes({
      billingRepository: new FakeBillingRepository(),
      paymentAttemptRepository,
    });

    const response = await app.request(`/billing-records/${billingRecord.id}/payment-attempts`, {
      method: "POST",
      body: JSON.stringify({
        provider: "provider-a",
        providerReference: "provider-ref-1",
        idempotencyKey: "pay-idem-1",
        correlationId: "corr-1",
        metadata: { checkoutId: "checkout-1" },
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      idempotentReplay: false,
      paymentAttempt: {
        billingRecordId: billingRecord.id,
        status: "pending",
        provider: "provider-a",
        providerReference: "provider-ref-1",
      },
    });
    expect(paymentAttemptRepository.created).toEqual([
      {
        billingRecordId: billingRecord.id,
        status: "pending",
        provider: "provider-a",
        providerReference: "provider-ref-1",
        idempotencyKey: "pay-idem-1",
        correlationId: "corr-1",
        metadata: { checkoutId: "checkout-1" },
      },
    ]);
  });

  it("reports payment status and maps it to billing status", async () => {
    const billingRepository = new FakeBillingRepository();
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const app = createBillingRoutes({ billingRepository, paymentAttemptRepository });

    const response = await app.request(
      `/billing-records/${billingRecord.id}/payment-attempts/${paymentAttempt.id}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status: "succeeded" }),
        headers: { "content-type": "application/json" },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      paymentAttempt: { status: "succeeded" },
      billingRecord: { status: "paid" },
    });
    expect(paymentAttemptRepository.updates).toEqual([
      { id: paymentAttempt.id, status: "succeeded" },
    ]);
    expect(billingRepository.updates).toEqual([{ id: billingRecord.id, status: "paid" }]);
  });

  it("rejects unsupported status transitions", async () => {
    const billingRepository = new FakeBillingRepository();
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const app = createBillingRoutes({ billingRepository, paymentAttemptRepository });

    const response = await app.request(
      `/billing-records/${billingRecord.id}/payment-attempts/${paymentAttempt.id}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status: "authorized" }),
        headers: { "content-type": "application/json" },
      },
    );

    expect(response.status).toBe(400);
    expect(paymentAttemptRepository.updates).toEqual([]);
    expect(billingRepository.updates).toEqual([]);
  });

  describe("with a configured payment gateway", () => {
    it("charges through the gateway when creating a payment attempt", async () => {
      const billingRepository = new FakeBillingRepository();
      const paymentAttemptRepository = new FakePaymentAttemptRepository();
      const paymentGateway = new FakePaymentGateway();
      const app = createBillingRoutes({
        billingRepository,
        paymentAttemptRepository,
        paymentGateway,
      });

      const response = await app.request(`/billing-records/${billingRecord.id}/payment-attempts`, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: "pay-idem-1",
          correlationId: "corr-1",
          payerEmail: "buyer@example.com",
        }),
        headers: { "content-type": "application/json" },
      });

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        idempotentReplay: false,
        paymentAttempt: {
          status: "succeeded",
          provider: "mercadopago",
          providerReference: "mp-ref-1",
        },
        billingRecord: { status: "paid" },
      });

      expect(paymentGateway.chargeCalls).toEqual([
        {
          billingRecordId: billingRecord.id,
          orderId: billingRecord.orderId,
          customerId: billingRecord.customerId,
          amountCents: billingRecord.amountCents,
          currency: billingRecord.currency,
          idempotencyKey: "pay-idem-1",
          correlationId: "corr-1",
          payerEmail: "buyer@example.com",
          metadata: undefined,
        },
      ]);
      expect(paymentAttemptRepository.created).toEqual([
        {
          billingRecordId: billingRecord.id,
          status: "succeeded",
          provider: "mercadopago",
          providerReference: "mp-ref-1",
          idempotencyKey: "pay-idem-1",
          correlationId: "corr-1",
          metadata: { gateway: { id: "mp-ref-1", status: "approved" } },
        },
      ]);
      expect(billingRepository.updates).toEqual([{ id: billingRecord.id, status: "paid" }]);
    });

    it("records a failed payment attempt and billing status when the gateway charge throws", async () => {
      const billingRepository = new FakeBillingRepository();
      const paymentAttemptRepository = new FakePaymentAttemptRepository();
      const paymentGateway = new FakePaymentGateway(new Error("card declined"));
      const app = createBillingRoutes({
        billingRepository,
        paymentAttemptRepository,
        paymentGateway,
      });

      const response = await app.request(`/billing-records/${billingRecord.id}/payment-attempts`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: "pay-idem-1", correlationId: "corr-1" }),
        headers: { "content-type": "application/json" },
      });

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        paymentAttempt: { status: "failed", provider: "mercadopago" },
        billingRecord: { status: "failed" },
      });
      expect(paymentAttemptRepository.created[0]?.metadata).toEqual({
        gatewayError: "card declined",
      });
      expect(billingRepository.updates).toEqual([{ id: billingRecord.id, status: "failed" }]);
    });

    it("resolves status via the gateway when reporting a providerReference (webhook style)", async () => {
      const billingRepository = new FakeBillingRepository();
      const paymentAttemptRepository = new FakePaymentAttemptRepository();
      const paymentGateway = new FakePaymentGateway();
      const app = createBillingRoutes({
        billingRepository,
        paymentAttemptRepository,
        paymentGateway,
      });

      const response = await app.request(
        `/billing-records/${billingRecord.id}/payment-attempts/${paymentAttempt.id}/status`,
        {
          method: "POST",
          body: JSON.stringify({ providerReference: "mp-ref-1" }),
          headers: { "content-type": "application/json" },
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        paymentAttempt: { status: "succeeded" },
        billingRecord: { status: "paid" },
      });
      expect(paymentGateway.statusCalls).toEqual(["mp-ref-1"]);
    });

    it("returns a gateway error response when the gateway status lookup fails", async () => {
      const billingRepository = new FakeBillingRepository();
      const paymentAttemptRepository = new FakePaymentAttemptRepository();
      const paymentGateway = new FakePaymentGateway(undefined, new Error("provider unreachable"));
      const app = createBillingRoutes({
        billingRepository,
        paymentAttemptRepository,
        paymentGateway,
      });

      const response = await app.request(
        `/billing-records/${billingRecord.id}/payment-attempts/${paymentAttempt.id}/status`,
        {
          method: "POST",
          body: JSON.stringify({ providerReference: "mp-ref-1" }),
          headers: { "content-type": "application/json" },
        },
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "gateway_error", message: "provider unreachable" },
      });
      expect(paymentAttemptRepository.updates).toEqual([]);
      expect(billingRepository.updates).toEqual([]);
    });

    it("rejects a providerReference status report when no gateway is configured", async () => {
      const billingRepository = new FakeBillingRepository();
      const paymentAttemptRepository = new FakePaymentAttemptRepository();
      const app = createBillingRoutes({ billingRepository, paymentAttemptRepository });

      const response = await app.request(
        `/billing-records/${billingRecord.id}/payment-attempts/${paymentAttempt.id}/status`,
        {
          method: "POST",
          body: JSON.stringify({ providerReference: "mp-ref-1" }),
          headers: { "content-type": "application/json" },
        },
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "gateway_unconfigured" },
      });
    });
  });
});
