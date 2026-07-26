import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { MercadoPagoConfig } from "../config/env";
import { MercadoPagoGateway } from "./mercadopago-gateway";
import { PaymentGatewayError } from "./payment-gateway";

const config: MercadoPagoConfig = {
  accessToken: "TEST-access-token",
  baseUrl: "https://api.mercadopago.test",
};

type RecordedRequest = {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
};

/**
 * Hand-rolled fetch stub (no mocking library, matching this repo's existing
 * fake-based test style) that records requests and returns a scripted
 * response so MercadoPagoGateway can be exercised without a live API.
 */
class FakeFetch {
  requests: RecordedRequest[] = [];
  private response: { status: number; body: unknown } = { status: 200, body: {} };
  private shouldThrow: Error | null = null;

  respondWith(status: number, body: unknown): void {
    this.response = { status, body };
  }

  throwOnNextCall(error: Error): void {
    this.shouldThrow = error;
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (this.shouldThrow) {
      const error = this.shouldThrow;
      this.shouldThrow = null;
      throw error;
    }

    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [key, value] of Object.entries(init.headers as Record<string, string>)) {
        headers[key] = value;
      }
    }

    this.requests.push({
      url: String(input),
      method: init?.method,
      headers,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });

    const { status, body } = this.response;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("MercadoPagoGateway", () => {
  let fakeFetch: FakeFetch;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    fakeFetch = new FakeFetch();
    originalFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch.fetch as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("charge", () => {
    it("creates a payment through the Mercado Pago Payments API and maps approved to succeeded", async () => {
      fakeFetch.respondWith(201, {
        id: 123456789,
        status: "approved",
        status_detail: "accredited",
      });
      const gateway = new MercadoPagoGateway(config);

      const result = await gateway.charge({
        billingRecordId: "billing-1",
        orderId: "order-1",
        customerId: "customer-1",
        amountCents: 2590,
        currency: "BRL",
        idempotencyKey: "idem-1",
        correlationId: "corr-1",
        payerEmail: "buyer@example.com",
      });

      expect(result).toEqual({
        providerReference: "123456789",
        status: "succeeded",
        raw: { id: 123456789, status: "approved", status_detail: "accredited" },
      });

      expect(fakeFetch.requests).toHaveLength(1);
      const request = fakeFetch.requests[0];
      expect(request.url).toBe("https://api.mercadopago.test/v1/payments");
      expect(request.method).toBe("POST");
      expect(request.headers.Authorization).toBe("Bearer TEST-access-token");
      expect(request.headers["X-Idempotency-Key"]).toBe("idem-1");
      expect(request.body).toMatchObject({
        transaction_amount: 25.9,
        external_reference: "corr-1",
        payer: { email: "buyer@example.com" },
      });
    });

    it("maps rejected to failed", async () => {
      fakeFetch.respondWith(201, {
        id: 2,
        status: "rejected",
        status_detail: "cc_rejected_other_reason",
      });
      const gateway = new MercadoPagoGateway(config);

      const result = await gateway.charge({
        billingRecordId: "billing-2",
        orderId: "order-2",
        customerId: "customer-2",
        amountCents: 1000,
        currency: "BRL",
        idempotencyKey: "idem-2",
        correlationId: "corr-2",
      });

      expect(result.status).toBe("failed");
      expect(result.providerReference).toBe("2");
    });

    it("throws a PaymentGatewayError when Mercado Pago responds with a non-2xx status", async () => {
      fakeFetch.respondWith(401, { message: "invalid access token", status: 401 });
      const gateway = new MercadoPagoGateway(config);

      await expect(
        gateway.charge({
          billingRecordId: "billing-3",
          orderId: "order-3",
          customerId: "customer-3",
          amountCents: 500,
          currency: "BRL",
          idempotencyKey: "idem-3",
          correlationId: "corr-3",
        }),
      ).rejects.toThrow(PaymentGatewayError);
    });

    it("throws a PaymentGatewayError when the network request fails", async () => {
      fakeFetch.throwOnNextCall(new Error("network down"));
      const gateway = new MercadoPagoGateway(config);

      await expect(
        gateway.charge({
          billingRecordId: "billing-4",
          orderId: "order-4",
          customerId: "customer-4",
          amountCents: 500,
          currency: "BRL",
          idempotencyKey: "idem-4",
          correlationId: "corr-4",
        }),
      ).rejects.toThrow(PaymentGatewayError);
    });
  });

  describe("getStatus", () => {
    it("queries the Mercado Pago payment by id and maps status", async () => {
      fakeFetch.respondWith(200, { id: 123456789, status: "in_process" });
      const gateway = new MercadoPagoGateway(config);

      const result = await gateway.getStatus("123456789");

      expect(result).toEqual({
        providerReference: "123456789",
        status: "processing",
        raw: { id: 123456789, status: "in_process" },
      });
      expect(fakeFetch.requests[0]?.url).toBe("https://api.mercadopago.test/v1/payments/123456789");
      expect(fakeFetch.requests[0]?.method).toBe("GET");
    });

    it("throws a PaymentGatewayError when the provider reference is not found", async () => {
      fakeFetch.respondWith(404, { message: "payment not found" });
      const gateway = new MercadoPagoGateway(config);

      await expect(gateway.getStatus("missing")).rejects.toThrow(PaymentGatewayError);
    });
  });
});
