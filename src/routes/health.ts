import { Hono } from "hono";
import type { DatabaseChecker } from "../database/postgres";

type HealthOptions = {
  databaseChecker: DatabaseChecker;
};

function createHealthRoutes(options: HealthOptions): Hono {
  const health = new Hono();

  health.get("/health", (c) => c.json({ status: "ok" }));

  health.get("/ready", async (c) => {
    const database = await options.databaseChecker.check();

    if (database.status !== "ok") {
      return c.json(
        {
          status: "not_ready",
          checks: { database },
        },
        503,
      );
    }

    return c.json({
      status: "ready",
      checks: { database },
    });
  });

  return health;
}

export { createHealthRoutes };
