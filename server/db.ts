import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

// Habilita SSL automaticamente para provedores que exigem (Neon, Supabase, etc.)
// e para conexoes externas. Desabilita para o Postgres interno do EasyPanel/Docker
// (rede privada, sem sslmode na URL). Pode forcar com PGSSL=true/false.
const wantsSSL =
  process.env.PGSSL === "true" ||
  (process.env.PGSSL !== "false" && /sslmode=require/i.test(connectionString));

export const pool = new Pool({
  connectionString,
  ssl: wantsSSL ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
