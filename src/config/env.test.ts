import { describe, expect, it } from "bun:test";
import { getAppConfig } from "./env";

describe("getAppConfig", () => {
  it("uses defaults when optional values are absent", () => {
    expect(getAppConfig({})).toEqual({ port: 3000 });
  });

  it("maps DATABASE_URL into Billing Service database config", () => {
    expect(
      getAppConfig({
        PORT: "8080",
        DATABASE_URL: "postgres://billing:billing@localhost:5432/workshop_billing",
        DATABASE_POOL_MAX: "8",
      }),
    ).toEqual({
      port: 8080,
      database: {
        url: "postgres://billing:billing@localhost:5432/workshop_billing",
        poolMax: 8,
      },
    });
  });

  it("maps RabbitMQ config with documented defaults", () => {
    expect(
      getAppConfig({
        RABBITMQ_URL: "amqp://localhost",
        RABBITMQ_CONSUMERS_ENABLED: "true",
        RABBITMQ_COMPENSATION_ROUTING_KEYS:
          "billing.payment.cancel.requested,billing.payment.refund.requested",
      }),
    ).toEqual({
      port: 3000,
      rabbitmq: {
        url: "amqp://localhost",
        exchange: "workshop.events",
        authorizationQueue: "workshop-billing.payment-authorize",
        compensationQueue: "workshop-billing.payment-compensation",
        authorizationRoutingKey: "billing.payment.authorize.requested",
        compensationRoutingKeys: [
          "billing.payment.cancel.requested",
          "billing.payment.refund.requested",
        ],
        statusRoutingKey: "billing.payment.status.changed",
        compensationResultRoutingKey: "billing.payment.compensation.completed",
        consumersEnabled: true,
      },
    });
  });

  it("leaves mercadopago unconfigured when MERCADOPAGO_ACCESS_TOKEN is absent", () => {
    expect(getAppConfig({}).mercadopago).toBeUndefined();
  });

  it("maps mercadopago config with a documented default base URL", () => {
    expect(
      getAppConfig({
        MERCADOPAGO_ACCESS_TOKEN: "TEST-access-token",
      }),
    ).toEqual({
      port: 3000,
      mercadopago: {
        accessToken: "TEST-access-token",
        baseUrl: "https://api.mercadopago.com",
      },
    });
  });

  it("allows overriding the mercadopago base URL", () => {
    expect(
      getAppConfig({
        MERCADOPAGO_ACCESS_TOKEN: "TEST-access-token",
        MERCADOPAGO_BASE_URL: "https://sandbox.mercadopago.example",
      }),
    ).toEqual({
      port: 3000,
      mercadopago: {
        accessToken: "TEST-access-token",
        baseUrl: "https://sandbox.mercadopago.example",
      },
    });
  });

  it("rejects invalid positive integer settings", () => {
    expect(() => getAppConfig({ PORT: "0" })).toThrow("PORT must be a positive integer");
    expect(() =>
      getAppConfig({ DATABASE_URL: "postgres://billing", DATABASE_POOL_MAX: "abc" }),
    ).toThrow("DATABASE_POOL_MAX must be a positive integer");
  });
});
