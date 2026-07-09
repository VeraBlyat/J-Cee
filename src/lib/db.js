import { Pool } from "pg";

// Reutilizamos un solo "pool" de conexiones a PostgreSQL.
// En desarrollo, Next recarga los módulos con frecuencia; guardar el pool
// en globalThis evita abrir cientos de conexiones sin querer.
const globalForDb = globalThis;

const pool =
  globalForDb._pgPool ||
  new Pool({ connectionString: process.env.DATABASE_URL });

if (!globalForDb._pgPool) globalForDb._pgPool = pool;

// Helper para consultar: query("SELECT ... WHERE id = $1", [valor])
export function query(text, params) {
  return pool.query(text, params);
}
