#!/bin/sh
set -e

# Espera a que PostgreSQL acepte conexiones. En compose el healthcheck de la
# BD ya nos cubre, pero si alguien levanta el contenedor suelto (docker run)
# esto evita el clásico "ECONNREFUSED" del primer arranque.
echo "Esperando a la base de datos..."
i=0
until node -e "
const { Client } = require('/app/backend/node_modules/pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "La base de datos no respondió después de 60s. Abortando." >&2
    exit 1
  fi
  sleep 2
done

# Migraciones: schema.sql usa CREATE TABLE IF NOT EXISTS, así que correrlas en
# cada arranque es seguro e idempotente.
node /app/backend/scripts/migrate.js

exec node /app/backend/dist/main.js
