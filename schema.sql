-- Base de datos de la plataforma de streaming.
-- Ejecuta este archivo una sola vez para crear las tablas.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,   -- Texto plano POR AHORA (inseguro). Se cambia después.
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  file_path VARCHAR(255) NOT NULL,  -- Ruta pública del archivo, ej: /uploads/123-video.mp4
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- CREATE TABLE IF NOT EXISTS no agrega columnas a una tabla que ya existe,
-- por eso usamos ALTER TABLE ... ADD COLUMN IF NOT EXISTS (idempotente,
-- necesario porque migrate.js corre en cada arranque del contenedor).
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'queued';

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS hls_path VARCHAR(255);  -- Ruta relativa al .m3u8 maestro (no URL completa); null hasta que termine el procesamiento

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);