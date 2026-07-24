# Arquitectura

UniStream (J&Cee) es una plataforma de streaming de video, versión MVP y local.
Está partida en **dos aplicaciones independientes** que corren como procesos
separados:

| Proceso            | Carpeta    | Puerto | Tecnología           | Responsabilidad                              |
| ------------------ | ---------- | ------ | -------------------- | -------------------------------------------- |
| **Frontend**       | `src/`     | `3000` | Next.js + Redux + Axios | Renderiza la interfaz. No toca la BD.     |
| **Backend / API**  | `backend/` | `3001` | Nest.js (TypeScript) | Lógica, PostgreSQL, archivos, autenticación. |
| **Base de datos**  | —          | `5432` | PostgreSQL           | Usuarios, videos y comentarios.              |

El backend es el **único** que habla con PostgreSQL y con el disco. El frontend
solo pide datos al backend por HTTP.

---

## Diagrama general

```
   Navegador
      │
      │  (1) HTML / navegación
      ▼
┌───────────────────┐        (2) fetch de datos          ┌───────────────────┐
│  Frontend Next.js │  ───────────────────────────────►  │  Backend Nest.js  │
│   localhost:3000  │        API REST + cookies          │   localhost:3001  │
│                   │  ◄───────────────────────────────  │                   │
│  - Componentes    │                                    │  - Controllers    │
│    de servidor    │                                    │  - Services       │
│  - Componentes    │        (3) el navegador pide        │  - Guards (auth)  │
│    de cliente     │        los videos directo           │  - /uploads       │
└───────────────────┘  ──────────────────────────────►   └─────────┬─────────┘
                          GET :3001/uploads/xxx.mp4                 │
                                                                    ▼
                                                            ┌───────────────┐
                                                            │  PostgreSQL   │
                                                            │  + carpeta    │
                                                            │  uploads/     │
                                                            └───────────────┘
```

1. El navegador carga las páginas desde Next.js.
2. Next.js (en el servidor) y el navegador (en el cliente) piden los datos al
   backend Nest.js.
3. Los archivos de video se sirven directamente desde el backend en `/uploads`.

---

## Cómo fluyen los datos

El frontend obtiene datos de **dos maneras**, según dónde corre el componente:

### Componentes de servidor (leer datos)

Páginas como el inicio, la página de un video y el `layout` (que resuelve la
sesión inicial) corren en el servidor de Next. Usan `serverFetch` de
[`src/lib/api.js`](../src/lib/api.js), que:

- Llama al backend (`GET /videos`, `/auth/me`, etc.).
- **Reenvía la cookie de sesión** del usuario al backend, para que el backend
  sepa quién está pidiendo.
- Nunca cachea (`cache: "no-store"`), así los datos siempre están frescos.

La URL usada aquí es `INTERNAL_API_URL` (servidor-a-servidor); ver
[`src/lib/apiBase.js`](../src/lib/apiBase.js).

### Componentes de cliente (acciones del usuario)

Formularios como login, subir video, comentar, cerrar sesión y el panel de admin
corren en el navegador. En vez de `fetch` sueltos, todos usan el cliente **Axios**
central [`src/lib/http.js`](../src/lib/http.js), que:

- Fija la `baseURL` en la API del backend (`NEXT_PUBLIC_API_URL`, de
  [`src/lib/apiBase.js`](../src/lib/apiBase.js)).
- Manda siempre la cookie de sesión con `withCredentials: true` (lo que antes era
  `credentials: "include"`).

### Estado global de la sesión (Redux Toolkit)

El usuario actual vive en un **store de Redux Toolkit** ([`src/store/`](../src/store)),
para que cualquier componente de cliente lo lea sin volver a pedirlo:

- [`store.js`](../src/store/store.js) — `makeStore(preloadedState)` crea **un store
  por request/cliente** (clave en Next para no compartir estado entre usuarios en
  el servidor) y permite hidratarlo con datos ya resueltos.
- [`authSlice.js`](../src/store/authSlice.js) — guarda `user` y expone los thunks
  `login`, `register` y `logout` (usan Axios y hablan con `/auth/*`), más la acción
  `setUser` para hidratar la sesión.
- [`ReduxProvider.js`](../src/components/ReduxProvider.js) — componente de cliente
  que monta el `Provider`. El [`layout.js`](../src/app/layout.js) resuelve la
  sesión en el servidor (`getCurrentUser`) y se la pasa como `initialUser` para
  hidratar el store, así el `Navbar` muestra al usuario desde el primer render
  **sin parpadeo**.

El `Navbar` es ahora un **componente de cliente** que lee `state.auth.user` con
`useSelector`, por lo que reacciona al instante cuando alguien inicia o cierra
sesión, sin recargar la página.

---

## Autenticación (sesión por cookie)

> ⚠️ **La seguridad es una fase posterior.** Hoy las contraseñas se guardan en
> texto plano y la sesión es una cookie simple con el id del usuario. Sirve para
> el MVP local, **no para producción**.

El flujo:

1. El usuario se registra o inicia sesión (`POST /auth/register` o `/auth/login`).
2. El backend valida y responde con una cookie **`userId`** (`httpOnly`,
   `sameSite=lax`).
3. En cada petición siguiente, la cookie viaja de vuelta al backend.
4. Los **guards** del backend leen la cookie y cargan al usuario:
   - `AuthGuard` — exige sesión válida; si no, responde `401`.
   - `AdminGuard` — exige que el usuario sea admin; si no, responde `403`.
5. `POST /auth/logout` borra la cookie.

En el frontend, los thunks `login` / `register` / `logout` del `authSlice`
disparan estas peticiones (vía Axios) y actualizan `state.auth.user`, así el
`Navbar` refleja el cambio al momento. Tras iniciar/cerrar sesión también se llama
a `router.refresh()` para re-sincronizar los componentes de servidor.

### ¿Por qué funciona la cookie entre dos puertos?

Frontend (`:3000`) y backend (`:3001`) son **orígenes distintos** pero **el mismo
host** (`localhost`). Las cookies se guardan por *host*, no por puerto, así que la
cookie que pone el backend viaja a ambos. Por eso:

- El backend habilita **CORS con credenciales** (`origin: http://localhost:3000`,
  `credentials: true`) — ver [`backend/src/main.ts`](../backend/src/main.ts).
- Los componentes de servidor pueden leer la cookie y reenviarla al backend.

En **producción** (dominios distintos con HTTPS) haría falta `SameSite=None;
Secure`. Está fuera del alcance de este MVP.

---

## Modelo de datos

Definido en [`schema.sql`](../schema.sql). Tres tablas:

```
users                         videos                        comments
─────────────                 ─────────────                 ─────────────
id            SERIAL PK       id          SERIAL PK         id          SERIAL PK
username      UNIQUE          title                         video_id    → videos(id) ON DELETE CASCADE
password      (texto plano)   description                   user_id     → users(id)
is_admin      BOOLEAN         file_path   (/uploads/xxx)    content
created_at                    user_id     → users(id)       created_at
                              created_at
```

- Un **usuario** sube muchos **videos** y escribe muchos **comentarios**.
- Un **video** tiene muchos **comentarios** (se borran en cascada con el video).
- `file_path` guarda la ruta pública del archivo (p. ej. `/uploads/123-clip.mp4`);
  el archivo real vive en `backend/uploads/`.

---

## Estructura del código

```
J-Cee/
├── schema.sql               -> tablas de PostgreSQL
├── README.md                -> puesta en marcha
├── docs/
│   ├── ARQUITECTURA.md      -> este archivo
│   └── API.md               -> referencia de la API REST
│
├── backend/                 -> API Nest.js (TypeScript)
│   ├── .env                 -> DATABASE_URL, PORT, FRONTEND_ORIGIN
│   ├── uploads/             -> archivos de video subidos
│   └── src/
│       ├── main.ts          -> arranque: CORS, cookies, /uploads, filtro de errores
│       ├── app.module.ts    -> junta todos los módulos
│       ├── database/        -> DatabaseService (pool de PostgreSQL)
│       ├── auth/            -> login/register/logout/me + AuthGuard/AdminGuard
│       ├── videos/         -> listar, detalle y subida (Multer)
│       ├── comments/       -> listar y crear comentarios
│       ├── admin/           -> gestión de usuarios/videos/comentarios
│       └── common/          -> filtro de excepciones ({ error: "..." })
│
└── src/                     -> frontend Next.js
    ├── lib/
    │   ├── api.js           -> serverFetch + getCurrentUser (para el servidor)
    │   ├── apiBase.js       -> URLs del backend (pública e interna)
    │   └── http.js          -> cliente Axios central (para el navegador)
    ├── store/               -> Redux Toolkit
    │   ├── store.js         -> makeStore (un store por request/cliente)
    │   └── authSlice.js     -> usuario global + thunks login/register/logout
    ├── components/
    │   ├── ReduxProvider.js -> monta el store e hidrata la sesión inicial
    │   ├── Navbar.js        -> barra superior (cliente, lee la sesión del store)
    │   ├── LogoutButton.js  -> cierra sesión (thunk) y limpia el store
    │   ├── VideoCard.js     -> tarjeta de cada video
    │   └── CommentForm.js   -> formulario de comentarios
    └── app/
        ├── layout.js            -> resuelve la sesión e hidrata el ReduxProvider
        ├── page.js              -> inicio: galería de videos
        ├── login/page.js        -> iniciar sesión / registrarse
        ├── upload/page.js       -> subir un video
        ├── videos/[id]/page.js  -> reproductor + comentarios
        └── admin/               -> panel de administración
```

---

## Módulos del backend

Cada módulo de Nest agrupa un controller (rutas HTTP) y un service (lógica + SQL):

- **DatabaseModule** — global. Expone `DatabaseService.query(text, params)`, que
  envuelve un único `Pool` de `pg`. Todos los demás módulos lo inyectan.
- **AuthModule** — `AuthService` (login/register/getUserById), `AuthController`
  (rutas `/auth/*`), y los guards `AuthGuard` y `AdminGuard`, que exporta para que
  los usen otros módulos.
- **VideosModule** — listar, detalle y subida. La subida usa `FileInterceptor`
  (Multer) para recibir el archivo y lo guarda en `backend/uploads/`.
- **CommentsModule** — listar comentarios de un video y crear uno nuevo.
- **AdminModule** — CRUD de moderación (usuarios, videos, comentarios), todo
  protegido con `AdminGuard`.

El detalle de cada endpoint está en [API.md](./API.md).
