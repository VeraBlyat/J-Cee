-- Base de datos de J&Cee.
--
-- Este archivo es el esquema canónico y es IDEMPOTENTE: se puede correr las
-- veces que haga falta (`npm run migrate` en backend/) sin destruir datos.
-- Para borrar todo y empezar de cero está `npm run db:reset`, que es un
-- comando aparte y explícito justamente para no hacerlo sin querer.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,

  -- Nombre público del canal (el "@handle" que se ve en videos y comentarios).
  -- NO es la credencial de acceso.
  username VARCHAR(50) UNIQUE NOT NULL,

  -- Credencial de acceso. Se guarda siempre en minúsculas y sin espacios
  -- (lo normaliza AuthService) para que el UNIQUE sea case-insensitive de
  -- hecho, sin depender de la extensión CITEXT.
  email VARCHAR(255) UNIQUE NOT NULL,

  -- Hash bcrypt, nunca la contraseña real. Un hash bcrypt ocupa 60 caracteres;
  -- los 255 dejan margen por si algún día cambiamos de algoritmo (argon2id).
  password VARCHAR(255) NOT NULL,

  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  file_path VARCHAR(255) NOT NULL,  -- Ruta pública del archivo, ej: /uploads/123-video.mp4

  -- ON DELETE CASCADE: si se borra el usuario, se van sus videos. Antes esto
  -- lo hacía a mano AdminService; ahora lo garantiza la base.
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para los JOIN y filtros que ya hace la app. Sin esto, listar los
-- comentarios de un video obliga a Postgres a recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos (user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments (video_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);

-- ============================================================
-- MIGRACIONES INCREMENTALES
-- Para bases que YA existen, donde el CREATE TABLE de arriba no hace nada.
-- ADD COLUMN IF NOT EXISTS es idempotente, así que correr esto de más es
-- inofensivo y no hace falta borrar datos para actualizar el esquema.
-- ============================================================

-- Fase 2 (HLS): metadata que se lee con ffprobe al subir el video.
-- Con estos tres datos podemos armar las playlists m3u8 con pura aritmética,
-- sin tocar el archivo: por eso los segmentos pueden generarse recién cuando
-- el player los pide.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration_seconds REAL;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS height INTEGER;

-- Fase 2 (subida avanzada): miniatura. Si el usuario no sube una, se saca un
-- fotograma del propio video con FFmpeg. Antes la grilla del inicio usaba el
-- MP4 completo como miniatura, o sea que bajaba los videos enteros para
-- mostrar un cuadrito.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(255);


-- ============================================================
-- HASHTAGS (Fase 2)
-- Relación muchos-a-muchos en vez de una columna de texto: así "todos los
-- videos con #nextjs" es un JOIN indexado y no un LIKE sobre toda la tabla.
-- Es la base para el descubrimiento por tema que necesitan los Reels.
-- ============================================================

CREATE TABLE IF NOT EXISTS hashtags (
  id SERIAL PRIMARY KEY,
  -- Siempre en minúsculas y sin el "#" (lo normaliza VideosService), para que
  -- #NextJS y #nextjs sean el mismo hashtag.
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS video_hashtags (
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  -- La clave compuesta evita duplicados y sirve de índice para "los hashtags
  -- de este video".
  PRIMARY KEY (video_id, hashtag_id)
);

-- El índice inverso: "los videos de este hashtag". La PK de arriba no sirve
-- para esta dirección porque video_id va primero.
CREATE INDEX IF NOT EXISTS idx_video_hashtags_hashtag ON video_hashtags (hashtag_id);


-- ============================================================
-- SUSCRIPCIONES (Fase 3)
-- Cada usuario es también un canal: no hace falta una tabla aparte, la
-- suscripción es una relación de users consigo misma.
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  -- Quién se suscribe.
  subscriber_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- A qué canal (que es otro usuario).
  channel_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),

  -- La clave compuesta hace que suscribirse dos veces sea imposible, sin
  -- necesidad de chequearlo antes en el código.
  PRIMARY KEY (subscriber_id, channel_id),

  -- Nadie se suscribe a su propio canal. Es una regla de negocio, pero se
  -- pone acá porque una restricción de la base no se puede saltear por un
  -- camino que nos olvidemos de validar.
  CONSTRAINT no_auto_suscripcion CHECK (subscriber_id <> channel_id)
);

-- La PK ya cubre "a qué canales sigo yo" (subscriber_id va primero). Este
-- índice es para la dirección contraria: "cuántos suscriptores tiene este
-- canal" y "quiénes son", que es la consulta de la página de canal.
CREATE INDEX IF NOT EXISTS idx_subscriptions_channel ON subscriptions (channel_id);


-- ============================================================
-- COMENTARIOS AVANZADOS (Fase 3)
-- Respuestas anidadas + votos.
-- ============================================================

-- Respuestas: un comentario puede colgar de otro. La jerarquía se guarda como
-- una auto-referencia en vez de una tabla aparte.
--
-- ON DELETE CASCADE sobre sí misma: al borrar un comentario se van todas sus
-- respuestas, y las respuestas de esas. Postgres lo resuelve recursivamente.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id INTEGER
  REFERENCES comments(id) ON DELETE CASCADE;

-- "Las respuestas de este comentario" es la consulta caliente al armar el hilo.
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);

-- Votos. No se guarda un contador en `comments` sino un voto por persona:
-- así se puede saber si VOS ya votaste, y nadie puede votar dos veces.
-- El total sale de un COUNT, que con el índice de abajo es barato.
CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 1 = like, -1 = dislike. Como número y no como booleano porque así el
  -- balance de votos es un SUM directo.
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMP DEFAULT NOW(),

  -- Un voto por persona por comentario. Cambiar de like a dislike es un
  -- UPDATE, no una fila nueva.
  PRIMARY KEY (comment_id, user_id)
);
