// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Neon URL
  ssl: { rejectUnauthorized: false }, // Importante no Neon
});

export const db = drizzle(pool);
