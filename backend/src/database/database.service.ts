import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

// Reutilizamos un solo "pool" de conexiones a PostgreSQL para toda la app.
// (Antes esto vivía en src/lib/db.js del proyecto Next.)
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
