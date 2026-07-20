import { Pool, type QueryResult, type QueryResultRow } from "pg";
import type { DatabaseConfig } from "../config/env";

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
};

export function createPostgresPool(config: DatabaseConfig): Pool {
  return new Pool({
    connectionString: config.url,
    max: config.poolMax,
  });
}

export type DatabaseHealth = {
  status: "ok" | "unconfigured" | "unavailable";
  detail?: string;
};

export type DatabaseChecker = {
  check(): Promise<DatabaseHealth>;
};

export class PostgresDatabaseChecker implements DatabaseChecker {
  constructor(private readonly db: Queryable) {}

  async check(): Promise<DatabaseHealth> {
    try {
      await this.db.query("SELECT 1");
      return { status: "ok" };
    } catch (error) {
      return {
        status: "unavailable",
        detail: error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }
}

export class UnconfiguredDatabaseChecker implements DatabaseChecker {
  async check(): Promise<DatabaseHealth> {
    return {
      status: "unconfigured",
      detail: "DATABASE_URL is not configured",
    };
  }
}
