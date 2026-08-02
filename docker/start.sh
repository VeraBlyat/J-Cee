#!/bin/sh
set -e

# Migraciones: usa CREATE TABLE IF NOT EXISTS, así que correrla en cada arranque
# del contenedor es seguro (no rompe nada si el esquema ya existe).
node /app/backend/scripts/migrate.js

# El backend arranca DESDE /app/backend a propósito. Resuelve las carpetas de
# uploads y de caché HLS con process.cwd(), pero sirve los estáticos con
# __dirname: si lo lanzáramos desde /app, escribiría los videos en
# /app/uploads y los serviría desde /app/backend/uploads (404 en todo).
cd /app/backend
PORT=3001 node dist/main.js &
BACKEND_PID=$!

cd /app
HOSTNAME=0.0.0.0 PORT="${PORT:-8080}" node server.js &
FRONTEND_PID=$!

# Si cualquiera de los dos procesos muere, bajamos el contenedor entero en vez
# de quedar corriendo a medias: Azure lo va a reiniciar.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 2
done
kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
wait 2>/dev/null || true
exit 1
