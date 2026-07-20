import { describe, expect, it } from "bun:test";
import type { DatabaseChecker } from "../database/postgres";
import { createHealthRoutes } from "./health";

function appWith(checker: DatabaseChecker) {
  return createHealthRoutes({ databaseChecker: checker });
}

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const app = appWith({ check: async () => ({ status: "ok" }) });

    const res = await app.request("/health");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("GET /ready", () => {
  it("returns 200 when the database check passes", async () => {
    const app = appWith({ check: async () => ({ status: "ok" }) });

    const res = await app.request("/ready");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "ready",
      checks: { database: { status: "ok" } },
    });
  });

  it("returns 503 when the database is unconfigured", async () => {
    const app = appWith({
      check: async () => ({ status: "unconfigured", detail: "DATABASE_URL is not configured" }),
    });

    const res = await app.request("/ready");

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      status: "not_ready",
      checks: {
        database: { status: "unconfigured", detail: "DATABASE_URL is not configured" },
      },
    });
  });

  it("returns 503 when the database is unavailable", async () => {
    const app = appWith({
      check: async () => ({ status: "unavailable", detail: "connection refused" }),
    });

    const res = await app.request("/ready");

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      status: "not_ready",
      checks: {
        database: { status: "unavailable", detail: "connection refused" },
      },
    });
  });
});
