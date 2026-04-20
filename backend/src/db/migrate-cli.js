import "dotenv/config";
import { env } from "../config/env.js";
import { closeSequelize, getSequelize } from "./sequelize.js";
import { runMigrations } from "./migrate.js";

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is required to run migrations");
  process.exit(1);
}

const sequelize = getSequelize();
await runMigrations(sequelize);
await closeSequelize();
console.log("Migrations complete.");
