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
  // NAO fixar aqui o timezone da sessao do Postgres para America/Sao_Paulo.
  // O Drizzle serializa/le colunas "timestamp" (sem fuso) sempre assumindo
  // UTC (toISOString() ao gravar, "+0000" ao ler - ver drizzle-orm/pg-core/
  // columns/timestamp). O now() do Postgres precisa continuar gravando em
  // UTC (padrao da sessao) para bater com essa suposicao; senao os limites
  // de data calculados em horario de Brasilia (ver process.env.TZ em
  // server/index.ts) ficam deslocados ~3h ao comparar com created_at.
});

export const db = drizzle(pool, { schema });
