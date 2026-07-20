export type DatabaseConfig = {
  url: string;
  poolMax: number;
};

export type RabbitMqConfig = {
  url: string;
  exchange: string;
  authorizationQueue: string;
  compensationQueue: string;
  authorizationRoutingKey: string;
  compensationRoutingKeys: string[];
  statusRoutingKey: string;
  compensationResultRoutingKey: string;
  consumersEnabled: boolean;
};

export type AppConfig = {
  port: number;
  database?: DatabaseConfig;
  rabbitmq?: RabbitMqConfig;
};

type EnvSource = Record<string, string | undefined>;

const DEFAULT_PORT = 3000;
const DEFAULT_DATABASE_POOL_MAX = 5;
const DEFAULT_RABBITMQ_EXCHANGE = "workshop.events";
const DEFAULT_AUTHORIZATION_QUEUE = "workshop-billing.payment-authorize";
const DEFAULT_COMPENSATION_QUEUE = "workshop-billing.payment-compensation";
const DEFAULT_AUTHORIZATION_ROUTING_KEY = "billing.payment.authorize.requested";
const DEFAULT_COMPENSATION_ROUTING_KEYS = [
  "billing.payment.compensation.requested",
  "billing.payment.cancel.requested",
  "billing.payment.refund.requested",
];
const DEFAULT_STATUS_ROUTING_KEY = "billing.payment.status.changed";
const DEFAULT_COMPENSATION_RESULT_ROUTING_KEY = "billing.payment.compensation.completed";

function parsePositiveInteger(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getRabbitMqConfig(env: EnvSource): RabbitMqConfig | undefined {
  const url = env.RABBITMQ_URL?.trim();
  if (!url) {
    return undefined;
  }

  return {
    url,
    exchange: env.RABBITMQ_EXCHANGE?.trim() || DEFAULT_RABBITMQ_EXCHANGE,
    authorizationQueue: env.RABBITMQ_AUTHORIZATION_QUEUE?.trim() || DEFAULT_AUTHORIZATION_QUEUE,
    compensationQueue: env.RABBITMQ_COMPENSATION_QUEUE?.trim() || DEFAULT_COMPENSATION_QUEUE,
    authorizationRoutingKey:
      env.RABBITMQ_AUTHORIZATION_ROUTING_KEY?.trim() || DEFAULT_AUTHORIZATION_ROUTING_KEY,
    compensationRoutingKeys: parseCsv(
      env.RABBITMQ_COMPENSATION_ROUTING_KEYS,
      DEFAULT_COMPENSATION_ROUTING_KEYS,
    ),
    statusRoutingKey: env.RABBITMQ_STATUS_ROUTING_KEY?.trim() || DEFAULT_STATUS_ROUTING_KEY,
    compensationResultRoutingKey:
      env.RABBITMQ_COMPENSATION_RESULT_ROUTING_KEY?.trim() ||
      DEFAULT_COMPENSATION_RESULT_ROUTING_KEY,
    consumersEnabled: parseBoolean(env.RABBITMQ_CONSUMERS_ENABLED, false),
  };
}

export function getAppConfig(env: EnvSource = process.env): AppConfig {
  const port = parsePositiveInteger(env.PORT, "PORT", DEFAULT_PORT);
  const databaseUrl = env.DATABASE_URL?.trim();
  const rabbitmq = getRabbitMqConfig(env);

  const baseConfig: AppConfig = { port };
  if (rabbitmq) {
    baseConfig.rabbitmq = rabbitmq;
  }

  if (!databaseUrl) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    database: {
      url: databaseUrl,
      poolMax: parsePositiveInteger(
        env.DATABASE_POOL_MAX,
        "DATABASE_POOL_MAX",
        DEFAULT_DATABASE_POOL_MAX,
      ),
    },
  };
}
