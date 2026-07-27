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

### `POST /auth/login`
Inicia sesión. Pone la cookie `userId`.

**Body**
```json
{ "username": "ana", "password": "1234" }
```
**200**
```json
{ "id": 1, "username": "ana" }
```
**401** — `{ "error": "Usuario o contraseña incorrectos." }`

---

### `POST /auth/register`
Crea una cuenta e inicia sesión (pone la cookie `userId`).

**Body**
```json
{ "username": "ana", "password": "1234" }
```
**200**
```json
{ "id": 1, "username": "ana" }
```
**400** — `{ "error": "Usuario y contraseña son obligatorios." }`
**409** — `{ "error": "Ese usuario ya existe." }`

---

### `POST /auth/logout`
Cierra sesión borrando la cookie. No necesita cuerpo.

**200** — `{ "ok": true }`

---

### `GET /auth/me`
Devuelve el usuario de la sesión actual, o `null` si no hay sesión.

**200**
```json
{ "id": 1, "username": "ana", "is_admin": false }
```
o `null`.

---

## Videos — `/videos`

### `GET /videos`
Lista todos los videos, del más nuevo al más viejo. Público.

**200**
```json
[
  { "id": 2, "title": "Mi clip", "file_path": "/uploads/123-clip.mp4", "username": "ana" }
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
  "username": "ana"
}
```
**404** — `{ "error": "Video no encontrado." }`

> El archivo se reproduce desde `http://localhost:3001` + `file_path`.

---

### `POST /videos` 🔒 sesión
Sube un video. Es `multipart/form-data`.

**Campos del formulario**

| Campo         | Tipo   | Obligatorio | Descripción              |
| ------------- | ------ | ----------- | ------------------------ |
| `title`       | texto  | sí          | Título del video         |
| `description` | texto  | no          | Descripción              |
| `file`        | archivo| sí          | El archivo de video (MP4)|

**200** — `{ "id": 2 }`
**400** — `{ "error": "Faltan datos o el archivo." }`
**401** — `{ "error": "Debes iniciar sesión." }`

El archivo se guarda en `backend/uploads/` con un nombre único
(`<timestamp>-<nombre>`) y se sirve en `/uploads/<nombre>`.

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
| `GET`    | `/uploads/:archivo`       | —      | Servir archivo de video        |
