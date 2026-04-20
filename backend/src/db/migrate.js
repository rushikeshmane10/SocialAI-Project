import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function migrationsDir() {
  return join(__dirname, "..", "..", "migrations");
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 */
export async function runMigrations(sequelize) {
  await sequelize.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

  const [appliedRows] = await sequelize.query("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.version));

  const files = readdirSync(migrationsDir())
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir(), file), "utf8");
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(sql, { transaction });
      await sequelize.query("INSERT INTO schema_migrations (version) VALUES ($1)", {
        bind: [file],
        transaction,
      });
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }
}
