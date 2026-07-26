import { Hono } from "hono";
import { getAppConfig } from "./config/env";
import {
  type DatabaseChecker,
  PostgresDatabaseChecker,
  UnconfiguredDatabaseChecker,
  createPostgresPool,
} from "./database/postgres";
import { MercadoPagoGateway } from "./gateways/mercadopago-gateway";
import type { PaymentGateway } from "./gateways/payment-gateway";
import { startRabbitMqRuntime } from "./messaging/rabbitmq";
import { BillingRepository, PaymentAttemptRepository } from "./repositories/billing";
import {
  type BillingRecordReaderWriter,
  type PaymentAttemptReaderWriter,
  createBillingRoutes,
} from "./routes/billing";
import { createHealthRoutes } from "./routes/health";

type AppOptions = {
  databaseChecker: DatabaseChecker;
  billingRepository?: BillingRecordReaderWriter;
  paymentAttemptRepository?: PaymentAttemptReaderWriter;
  paymentGateway?: PaymentGateway;
};

export function createApp(options: AppOptions): Hono {
  const app = new Hono();
  app.route("/", createHealthRoutes({ databaseChecker: options.databaseChecker }));
  app.route(
    "/",
    createBillingRoutes({
      billingRepository: options.billingRepository,
      paymentAttemptRepository: options.paymentAttemptRepository,
      paymentGateway: options.paymentGateway,
    }),
  );
  return app;
}

const config = getAppConfig();
const pool = config.database ? createPostgresPool(config.database) : undefined;
const databaseChecker = pool
  ? new PostgresDatabaseChecker(pool)
  : new UnconfiguredDatabaseChecker();
const billingRepository = pool ? new BillingRepository(pool) : undefined;
const paymentAttemptRepository = pool ? new PaymentAttemptRepository(pool) : undefined;
// Optional and disabled by default: only wired when MERCADOPAGO_ACCESS_TOKEN is
// configured. When absent, payment-attempt creation stays gateway-agnostic.
const paymentGateway = config.mercadopago ? new MercadoPagoGateway(config.mercadopago) : undefined;
const app = createApp({
  databaseChecker,
  billingRepository,
  paymentAttemptRepository,
  paymentGateway,
});

if (config.rabbitmq?.consumersEnabled && billingRepository && paymentAttemptRepository) {
  startRabbitMqRuntime({
    config: config.rabbitmq,
    billingRepository,
    paymentAttemptRepository,
  }).catch((error) => {
    console.error("RabbitMQ runtime failed to start", error);
  });
}

export default {
  port: config.port,
  fetch: app.fetch,
};
