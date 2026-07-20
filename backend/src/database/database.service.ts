import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

// Reutilizamos un solo "pool" de conexiones a PostgreSQL para toda la app.
// (Antes esto vivía en src/lib/db.js del proyecto Next.)
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  // Azure Database for PostgreSQL exige SSL; localhost no lo soporta.
  // DATABASE_SSL=true lo activa (con rejectUnauthorized:false porque Azure
  // firma con una CA propia que no viene en el store por defecto de Node).
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  // Helper para consultar: query("SELECT ... WHERE id = $1", [valor])
  query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
