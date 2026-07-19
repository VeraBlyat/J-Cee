# J&Cee

App full-stack hecha con **Next.js (frontend) + Nest.js (backend) + PostgreSQL**.
Versión MVP y local. Son **dos procesos**: el frontend en el puerto `3000` y el
backend en el `3001`.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md) — cómo encajan frontend, backend y BD,
  el flujo de datos, la autenticación y el modelo de datos.
- [Referencia de la API](docs/API.md) — todos los endpoints del backend, con
  ejemplos de petición y respuesta.
- [Cómo contribuir](CONTRIBUTING.md) — flujo de ramas, commits y Pull
  Requests.

---

## Requisitos previos

- **Node.js** (versión LTS) instalado.
- **PostgreSQL** instalado y corriendo, y saber la contraseña del usuario `postgres`.

---

## Cómo se organiza el código

- El **backend Nest.js** (carpeta `backend/`) es el ÚNICO que habla con PostgreSQL.
  Expone una API REST: autenticación, videos, comentarios y panel de admin. También
  guarda los archivos subidos y los sirve en `/uploads`.
- El **frontend Next.js** (carpeta `src/`) ya no toca la base de datos: pide todo
  al backend por HTTP.
  - Los *Componentes de Servidor* (inicio, página de video, navbar) usan
    `serverFetch` de `src/lib/api.js`, que reenvía la cookie de sesión al backend.
  - Los componentes de cliente (login, subir, comentar, admin) llaman al backend
    con `fetch(..., { credentials: "include" })`.

```
backend/                     -> API Nest.js (TypeScript)
└── src/
    ├── main.ts              -> arranque: CORS, cookies, /uploads estático
    ├── database/            -> pool de PostgreSQL (DatabaseService)
    ├── auth/                -> login/register/logout/me + guards de sesión y admin
    ├── videos/             -> listar, detalle y subida (Multer)
    ├── comments/           -> listar y crear comentarios
    └── admin/               -> gestión de usuarios/videos/comentarios

src/                         -> frontend Next.js
├── lib/
│   ├── api.js               -> serverFetch + getCurrentUser (llaman al backend)
│   └── apiBase.js           -> URL base del backend (NEXT_PUBLIC_API_URL)
├── components/
│   ├── Navbar.js            -> barra superior con la sesión
│   ├── LogoutButton.js      -> cierra sesión llamando al backend
│   ├── VideoCard.js         -> tarjeta de cada video en la galería
│   └── CommentForm.js       -> formulario de comentarios
└── app/
    ├── page.js              -> inicio: galería de videos
    ├── login/page.js        -> iniciar sesión / registrarse
    ├── upload/page.js       -> subir un video
    ├── videos/[id]/page.js  -> reproductor + comentarios de un video
    └── admin/               -> panel de administración
```

---

## Puesta en marcha (paso a paso)

### 1. Crear la base de datos

Abre una terminal de PostgreSQL (`psql -U postgres`) y crea la base:

```sql
CREATE DATABASE jandcee;
```

Sal de psql (`\q`) y carga las tablas con el archivo `schema.sql`:

```bash
psql -U postgres -d jandcee -f schema.sql
```

### 2. Configurar la conexión

**Backend** (`backend/.env`): copia el ejemplo y pon TU contraseña de Postgres:

```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` y ajusta `DATABASE_URL`. Ahí también viven `PORT` (3001) y
`FRONTEND_ORIGIN` (http://localhost:3000).

**Frontend** (`.env.local`): apunta al backend (ya viene con el valor por defecto):

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Instalar dependencias

Frontend y backend tienen sus propias dependencias:

```bash
npm install                 # frontend (raíz del repo)
npm install --prefix backend  # backend Nest.js
```

### 4. Arrancar la app (dos terminales)

```bash
# Terminal 1 — backend Nest.js (puerto 3001)
npm run start:dev --prefix backend

# Terminal 2 — frontend Next.js (puerto 3000)
npm run dev
```

Abre `http://localhost:3000`. Regístrate, sube un MP4 y reprodúcelo. ¡Listo!

---

## Prueba rápida del flujo completo

1. Entra a **Entrar** y crea una cuenta (usuario + contraseña).
2. Ve a **Subir video**, pon un título y elige un archivo MP4 chico.
3. Al subirlo te lleva a la página del video: se reproduce con los controles.
4. Regresa a **Inicio**: el video aparece en la galería.
5. Escribe un comentario y aparece al instante.

---

## TODO

Estas cosas se dejaron fuera a propósito para mantener el MVP simple:

- **Seguridad:** Encriptacion de contraseñas con bcrypt.
- **Almacenamiento en la nube:** Los videos se guardan en `backend/uploads`. Solo para uso local. Implementar Azure para
  almacenamiento en la nube.
- **Videos grandes:** Para archivos muy pesados haría falta subida por partes (chunks). Diferentes niveles de calidad
  (480p, 720p, 1080p, etc)
- **Transcodificación / calidades:** Implementecion de FFmpeg + HLS.
- **Miniaturas reales:** Subir miniaturas hechas por el usuario o generar frames para hacer miniaturas automaticas
  (FFMPEG).
