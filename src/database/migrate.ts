import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { getAppConfig } from "../config/env";
import { type Queryable, createPostgresPool } from "./postgres";

const MIGRATIONS_DIR = new URL("./migrations", import.meta.url).pathname;

export async function runMigrations(
  db: Queryable,
  migrationsDir = MIGRATIONS_DIR,
): Promise<string[]> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const appliedResult = await db.query<{ id: string }>("SELECT id FROM schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => row.id));
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  const executed: string[] = [];

  for (const file of files) {
    const migrationId = basename(file);
    if (applied.has(migrationId)) {
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), "utf8");
    await db.query("BEGIN");
    try {
      await db.query(sql);
      await db.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migrationId]);
      await db.query("COMMIT");
      executed.push(migrationId);
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }

  return executed;
}

if (import.meta.main) {
  const config = getAppConfig();
  if (!config.database) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const pool = createPostgresPool(config.database);
  try {
    const executed = await runMigrations(pool);
    console.log(
      executed.length === 0
        ? "No pending migrations"
        : `Applied migrations: ${executed.join(", ")}`,
    );
  } finally {
    await pool.end();
  }
}
