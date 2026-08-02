# Referencia de la API

API REST del backend Nest.js. Base: **`http://localhost:3001`** (configurable con
`PORT` en `backend/.env`).

## Convenciones

- El cuerpo de las peticiones y respuestas es **JSON**, salvo la subida de video
  (que es `multipart/form-data`).
- La **sesión** es una cookie `userId` que pone el backend al iniciar sesión. El
  navegador debe enviar las peticiones con credenciales: el frontend usa el
  cliente Axios `src/lib/http.js` (con `withCredentials: true`), y el servidor de
  Next reenvía la cookie con `serverFetch`.
- Los **errores** siempre tienen la forma `{ "error": "mensaje" }` con el código
  HTTP correspondiente.

### Códigos de estado usados

| Código | Significado                                             |
| ------ | ------------------------------------------------------ |
| `200`  | OK                                                     |
| `400`  | Petición inválida (faltan datos, acción no permitida)  |
| `401`  | No autenticado (falta sesión o credenciales incorrectas) |
| `403`  | Autenticado pero sin permiso (no es admin)             |
| `404`  | No encontrado                                          |
| `409`  | Conflicto (p. ej. usuario ya existe)                   |

---

## Autenticación — `/auth`

> **La credencial es el `email`.** El `username` es el nombre público del canal
> (el que se ve en videos y comentarios) y sólo se envía al registrarse.
> Las contraseñas se guardan hasheadas con **bcrypt** (costo 10); la base nunca
> ve la contraseña real.

### `POST /auth/login`
Inicia sesión. Pone la cookie `userId`.

**Body**
```json
{ "email": "ana@mail.com", "password": "contraseña123" }
```
**200**
```json
{ "id": 1, "username": "ana", "email": "ana@mail.com" }
```
**401** — `{ "error": "Email o contraseña incorrectos." }`

El mismo 401 se devuelve tanto si el email no existe como si la contraseña es
incorrecta, y ambos casos tardan lo mismo: es a propósito, para que nadie pueda
averiguar qué emails están registrados.

---

### `POST /auth/register`
Crea una cuenta e inicia sesión (pone la cookie `userId`).

El email se normaliza (se pasa a minúsculas y se le quitan los espacios) antes
de guardarlo, así que `Ana@Mail.com` y `ana@mail.com` son la misma cuenta.

**Body**
```json
{ "email": "ana@mail.com", "username": "ana", "password": "contraseña123" }
```
**201**
```json
{ "id": 1, "username": "ana", "email": "ana@mail.com" }
```

**Reglas de validación**

| Campo      | Regla                                                        |
| ---------- | ------------------------------------------------------------ |
| `email`    | Formato válido, único                                         |
| `username` | Entre 3 y 50 caracteres, único                                |
| `password` | Entre 8 y 72 caracteres (72 es el límite de bcrypt)           |

**400** — `{ "error": "Email, nombre de usuario y contraseña son obligatorios." }`
o el mensaje de la regla que se haya incumplido.
**409** — `{ "error": "Ese email ya está registrado." }`
o `{ "error": "Ese nombre de usuario ya está en uso." }`

---

### `POST /auth/logout`
Cierra sesión borrando la cookie. No necesita cuerpo.

**200** — `{ "ok": true }`

---

### `GET /auth/me`
Devuelve el usuario de la sesión actual, o `null` si no hay sesión.

**200**
```json
{ "id": 1, "username": "ana", "email": "ana@mail.com", "is_admin": false }
```
o `null`.

---

## Videos — `/videos`

### `GET /videos`
Lista todos los videos, del más nuevo al más viejo. Público.

**Query params**

| Parámetro | Descripción                                                     |
| --------- | --------------------------------------------------------------- |
| `hashtag` | Filtra por tema. Se normaliza igual que al subir, así que `nextjs`, `NextJS` y `%23NextJS` son equivalentes. |

**200**
```json
[
  {
    "id": 2,
    "title": "Mi clip",
    "file_path": "/uploads/123-clip.mp4",
    "thumbnail_path": "/uploads/123-clip.mp4.thumb.jpg",
    "duration_seconds": 212.5,
    "username": "ana"
  }
]
```

---

### `GET /videos/:id`
Detalle de un video. Público.

**200**
```json
{
  "id": 2,
  "title": "Mi clip",
  "description": "una descripción",
  "file_path": "/uploads/123-clip.mp4",
  "thumbnail_path": "/uploads/123-clip.mp4.thumb.jpg",
  "duration_seconds": 212.5,
  "width": 1920,
  "height": 1080,
  "username": "ana",
  "hashtags": ["nestjs", "nextjs"]
}
```
**404** — `{ "error": "Video no encontrado." }`

> `file_path` sigue siendo el MP4 original. Para reproducir, usá HLS (abajo).

---

### `POST /videos` 🔒 sesión
Sube un video. Es `multipart/form-data`.

**Campos del formulario**

| Campo         | Tipo   | Obligatorio | Descripción                          |
| ------------- | ------ | ----------- | ------------------------------------ |
| `title`       | texto  | sí          | Título del video                     |
| `description` | texto  | no          | Descripción                          |
| `hashtags`    | texto  | no          | Separados por espacios o comas       |
| `file`        | archivo| sí          | El archivo de video (MP4)            |
| `thumbnail`   | archivo| no          | Miniatura; si falta se genera sola   |

**201** — `{ "id": 2 }`
**400** — `{ "error": "Faltan datos o el archivo." }`
o `{ "error": "El archivo no es un video válido o está dañado." }`
**401** — `{ "error": "Debes iniciar sesión." }`
**413** — el archivo supera los 500 MB.

El archivo se guarda en `backend/uploads/` con un nombre único
(`<timestamp>-<nombre>`). Al subirlo se corre `ffprobe`, que cumple dos
funciones: guarda duración y resolución (necesarias para armar las playlists),
y valida que el contenido sea realmente un video — la extensión y el mimetype
los manda el cliente y se pueden falsear.

**Hashtags.** Se normalizan a minúsculas y sin `#`, se deduplican y se cortan
en 10. Se conservan acentos, ñ, guiones y guiones bajos; el resto de la
puntuación se descarta. `"#NextJS, nestjs #NEXTJS"` queda en
`["nextjs", "nestjs"]`.

**Miniatura.** Nunca se publica el archivo del usuario tal cual: se reencodea a
JPEG de 640 px de ancho. Además de normalizar tamaño y descartar metadatos
(EXIF con geolocalización, por ejemplo), es la única validación confiable —
`ffprobe` deduce el formato por la extensión y a un archivo de texto llamado
`foto.png` le responde `codec_name=png` con código de salida 0. Sólo al
decodificarlo se cae. Si la imagen no se puede decodificar, se cae a un
fotograma del video (al 10 % de la duración, con tope de 10 s) en vez de
rechazar la subida.

---

## Streaming HLS — `/videos/:id/hls`

Los segmentos se generan **bajo demanda**: no se transcodifica nada al subir.
Las playlists se calculan con aritmética sobre la duración y listan segmentos
que todavía no existen; FFmpeg corre recién cuando el player pide uno.

Formato **fMP4 (CMAF)**, no MPEG-TS: empalmar segmentos encodeados por separado
en TS deja discontinuidades de timestamp en cada corte (medido: 17 warnings de
DTS y paquetes corruptos en un video de 20 s), y con fMP4 el mismo video da
cero. El costo es un segmento de init aparte por calidad.

> **Post-proceso de los segmentos.** Lo que escribe FFmpeg no sirve tal cual y
> se corrige en `fmp4.ts` antes de guardarlo en caché:
>
> 1. **Separar init de media.** FFmpeg escribe un MP4 completo; el segmento se
>    queda sólo con `moof`+`mdat`. Si conservara su propio `moov`, el player
>    reinicializaría el decoder en cada cachito.
> 2. **Reescribir el `tfdt`.** Cada segmento se encodea por separado, así que
>    sale declarando que empieza en el segundo 0 — y ni `-output_ts_offset` ni
>    `-copyts` se lo llevan al muxer MP4. Con todos en 0, MSE los apila en el
>    mismo punto de la línea de tiempo y sólo se ve el primero. Se reescribe
>    con la posición global, convertida al timescale de cada pista (video y
>    audio usan escalas distintas, típicamente 15360 y 48000).
>
> Ojo también con `-force_key_frames`: la expresión tiene que ser `eq(n,0)`
> (sólo el primer frame). Con `gte(t,0)` es verdadera para *todos* los frames y
> FFmpeg encodea en all-intra — medido, 7,4× más pesado.

**Calidades:** 360p y 720p, nunca escalando hacia arriba. Una fuente 480p sólo
ofrece 360p; una fuente menor a 360p se sirve en su resolución nativa.

### `GET /videos/:id/hls/master.m3u8`
Playlist maestra: las calidades disponibles, para que el player elija sola
según el ancho de banda. Público.

**404** — si el video no existe, o si se subió antes de la Fase 2 y no tiene
metadata de streaming.

---

### `GET /videos/:id/hls/:quality/index.m3u8`
Playlist de una calidad: la lista de segmentos. Público.

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:6
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="init.mp4"
#EXTINF:6.000,
0.m4s
...
#EXT-X-ENDLIST
```

**404** — `{ "error": "Esa calidad no existe para este video." }`

---

### `GET /videos/:id/hls/:quality/init.mp4`
Segmento de init (`EXT-X-MAP`): sólo las cabeceras de códec (`ftyp` + `moov`),
~1,3 KB. El player lo pide una vez por calidad y lo antepone a cada segmento.

---

### `GET /videos/:id/hls/:quality/:index.m4s`
El segmento en sí. **Acá es donde corre FFmpeg**, si no está en caché.

**404** — si el índice queda fuera del rango real de segmentos.

Se sirve con `Cache-Control: immutable`: el mismo video, calidad e índice dan
siempre el mismo resultado, así que el navegador puede guardarlo para siempre
y rebobinar no re-transcodifica.

**Control de carga** — es lo que hace viable el enfoque JIT:

| Mecanismo         | Qué hace                                                        |
| ----------------- | --------------------------------------------------------------- |
| Deduplicación     | N pedidos del mismo segmento sin cachear ⇒ **un solo** FFmpeg    |
| Semáforo          | Nunca más de `HLS_MAX_CONCURRENT` FFmpeg a la vez (default 2)    |
| Caché en disco    | En `backend/hls-cache/`, podada por LRU al pasar `HLS_CACHE_MAX_BYTES` (default 2 GB) |
| Escritura atómica | Se escribe a `.tmp` y se renombra, así nadie lee un archivo a medio escribir |

**Variables de entorno**

| Variable                | Default | Para qué                                   |
| ----------------------- | ------- | ------------------------------------------ |
| `HLS_MAX_CONCURRENT`    | `2`     | Tope de FFmpeg simultáneos                 |
| `HLS_CACHE_MAX_BYTES`   | `2 GB`  | Tamaño máximo de la caché de segmentos     |

---

## Comentarios

### `GET /videos/:id/comments`
Lista los comentarios de un video, del más nuevo al más viejo. Público.

**200**
```json
[
  { "id": 5, "content": "¡Buen video!", "created_at": "2026-07-13T18:00:00.000Z", "username": "ana" }
]
```

---

### `POST /comments` 🔒 sesión
Crea un comentario en un video.

**Body**
```json
{ "videoId": 2, "content": "¡Buen video!" }
```
**200** — `{ "ok": true }`
**400** — `{ "error": "Falta el comentario." }`
**401** — `{ "error": "Debes iniciar sesión." }`

---

## Administración — `/admin` 🔒 admin

Todas las rutas de `/admin` exigen una sesión de **administrador**. Sin ella:
**403** — `{ "error": "No autorizado." }`.

### Usuarios

#### `GET /admin/users`
Lista todos los usuarios.
```json
[
  { "id": 1, "username": "ana", "is_admin": false, "created_at": "2026-07-10T19:13:17.299Z" }
]
```

#### `PATCH /admin/users`
Cambia el rol (admin / no admin) de un usuario.

**Body** — `{ "id": 1, "is_admin": true }`
**200** — `{ "ok": true }`
**400** — `{ "error": "No puedes modificar tu propio rol." }` (si `id` es el tuyo)

#### `DELETE /admin/users`
Elimina un usuario y **todo su contenido** (comentarios, videos y sus archivos).

**Body** — `{ "id": 1 }`
**200** — `{ "ok": true }`
**400** — `{ "error": "No puedes eliminar tu propia cuenta." }` (si `id` es el tuyo)

### Videos

#### `GET /admin/videos`
Lista todos los videos con su autor.
```json
[
  { "id": 2, "title": "Mi clip", "file_path": "/uploads/123-clip.mp4", "created_at": "…", "username": "ana" }
]
```

#### `DELETE /admin/videos`
Elimina un video y borra su archivo del disco.

**Body** — `{ "id": 2 }`
**200** — `{ "ok": true }`
**404** — `{ "error": "Video no encontrado." }`

### Comentarios

#### `GET /admin/comments`
Lista todos los comentarios con su autor y su video.
```json
[
  { "id": 5, "content": "¡Buen video!", "created_at": "…", "username": "ana", "video_title": "Mi clip", "video_id": 2 }
]
```

#### `DELETE /admin/comments`
Elimina un comentario.

**Body** — `{ "id": 5 }`
**200** — `{ "ok": true }`

---

## Archivos estáticos

### `GET /uploads/:archivo`
Sirve un archivo de video subido. Es lo que se pone en el `src` del reproductor.
Ejemplo: `http://localhost:3001/uploads/1783990121754-clip.mp4`.

---

## Resumen de rutas

| Método   | Ruta                      | Auth   | Descripción                    |
| -------- | ------------------------- | ------ | ------------------------------ |
| `POST`   | `/auth/register`          | —      | Crear cuenta + iniciar sesión  |
| `POST`   | `/auth/login`             | —      | Iniciar sesión                 |
| `POST`   | `/auth/logout`            | —      | Cerrar sesión                  |
| `GET`    | `/auth/me`                | —      | Usuario de la sesión           |
| `GET`    | `/videos`                 | —      | Listar videos                  |
| `GET`    | `/videos/:id`             | —      | Detalle de un video            |
| `POST`   | `/videos`                 | 🔒     | Subir un video                 |
| `GET`    | `/videos/:id/comments`    | —      | Comentarios de un video        |
| `POST`   | `/comments`               | 🔒     | Crear comentario               |
| `GET`    | `/admin/users`            | 🔒 admin | Listar usuarios              |
| `PATCH`  | `/admin/users`            | 🔒 admin | Cambiar rol                  |
| `DELETE` | `/admin/users`            | 🔒 admin | Eliminar usuario             |
| `GET`    | `/admin/videos`           | 🔒 admin | Listar videos                |
| `DELETE` | `/admin/videos`           | 🔒 admin | Eliminar video               |
| `GET`    | `/admin/comments`         | 🔒 admin | Listar comentarios           |
| `DELETE` | `/admin/comments`         | 🔒 admin | Eliminar comentario          |
| `GET`    | `/videos/:id/hls/master.m3u8`            | —      | Playlist maestra (calidades) |
| `GET`    | `/videos/:id/hls/:quality/index.m3u8`    | —      | Playlist de segmentos        |
| `GET`    | `/videos/:id/hls/:quality/init.mp4`      | —      | Cabeceras de códec (fMP4)    |
| `GET`    | `/videos/:id/hls/:quality/:index.m4s`    | —      | Segmento (corre FFmpeg)      |
| `GET`    | `/uploads/:archivo`       | —      | Servir archivo de video        |
