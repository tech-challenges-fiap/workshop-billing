import { describe, expect, it } from "bun:test";
import type { QueryResult, QueryResultRow } from "pg";
import { PostgresDatabaseChecker, type Queryable, UnconfiguredDatabaseChecker } from "./postgres";

class FakeDb implements Queryable {
  queries: string[] = [];

  constructor(private readonly failure?: Error) {}

  async query<T extends QueryResultRow = QueryResultRow>(text: string): Promise<QueryResult<T>> {
    this.queries.push(text);
    if (this.failure) {
      throw this.failure;
    }

    return { rows: [] } as unknown as QueryResult<T>;
  }
}

describe("PostgresDatabaseChecker", () => {
  it("returns ok after SELECT 1 succeeds", async () => {
    const db = new FakeDb();
    const checker = new PostgresDatabaseChecker(db);

    await expect(checker.check()).resolves.toEqual({ status: "ok" });
    expect(db.queries).toEqual(["SELECT 1"]);
  });

  it("returns unavailable after SELECT 1 fails", async () => {
    const checker = new PostgresDatabaseChecker(new FakeDb(new Error("connection refused")));

    await expect(checker.check()).resolves.toEqual({
      status: "unavailable",
      detail: "connection refused",
    });
  });
});

describe("UnconfiguredDatabaseChecker", () => {
  it("reports explicit unconfigured status", async () => {
    const checker = new UnconfiguredDatabaseChecker();

    await expect(checker.check()).resolves.toEqual({
      status: "unconfigured",
      detail: "DATABASE_URL is not configured",
    });
  });
});
