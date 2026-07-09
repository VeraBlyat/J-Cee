# UniStream — Plataforma de streaming universitaria

App full-stack hecha con **Next.js (App Router) + PostgreSQL**. Permite registrarse,
subir videos MP4, verlos en una galería, reproducirlos en el navegador y comentar.

Versión MVP y local: **sin nube, sin encriptación de contraseñas, sin transcodificación.**
Todo eso son mejoras para más adelante (ver la sección "Pendientes / a mejorar").

---

## Requisitos previos

- **Node.js** (versión LTS) instalado.
- **PostgreSQL** instalado y corriendo, y saber la contraseña del usuario `postgres`.

---

## Cómo se organiza el código

- **Páginas que solo muestran datos** (inicio y página de video) son *Componentes de
  Servidor*: consultan la base de datos directamente con el helper de `src/lib/db.js`.
- **Acciones que dispara el usuario** (registrarse, iniciar sesión, subir video,
  comentar) pasan por la *API* en `src/app/api/.../route.js`.

Ese es el patrón normal de Next.js App Router: leer en el servidor, y usar la API
para las acciones que vienen del navegador.

```
src/
├── lib/
│   ├── db.js          -> conexión a PostgreSQL
│   └── auth.js        -> lee la sesión (cookie) y devuelve el usuario
├── components/
│   ├── Navbar.js      -> barra superior con la sesión
│   ├── VideoCard.js   -> tarjeta de cada video en la galería
│   └── CommentForm.js -> formulario de comentarios
└── app/
    ├── page.js              -> inicio: galería de videos
    ├── login/page.js        -> iniciar sesión / registrarse
    ├── upload/page.js        -> subir un video
    ├── videos/[id]/page.js   -> reproductor + comentarios de un video
    └── api/
        ├── auth/{register,login,logout}/route.js
        ├── videos/route.js   -> recibe y guarda el video subido
        └── comments/route.js -> guarda un comentario
```

---

## Puesta en marcha (paso a paso)

### 1. Crear la base de datos

Abre una terminal de PostgreSQL (`psql -U postgres`) y crea la base:

```sql
CREATE DATABASE mi_streaming;
```

Sal de psql (`\q`) y carga las tablas con el archivo `schema.sql`:

```bash
psql -U postgres -d mi_streaming -f schema.sql
```

### 2. Configurar la conexión

Copia el archivo de ejemplo y pon TU contraseña:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` y cambia `TU_PASSWORD` por la contraseña real de `postgres`.

### 3. Instalar dependencias

Estas son las dependencias que ya trae `create-next-app`, más el conector de Postgres:

```bash
npm install
npm install pg
```

> Si empezaste este proyecto desde cero con `create-next-app`, simplemente copia las
> carpetas `src/`, `public/`, `schema.sql` y `.env.local.example` dentro de tu proyecto,
> y luego corre `npm install pg`.

### 4. Arrancar la app

```bash
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

## Pendientes / a mejorar (fases siguientes)

Estas cosas se dejaron fuera a propósito para mantener el MVP simple:

- **Seguridad:** las contraseñas se guardan en texto plano. Antes de que lo use gente
  real, hay que encriptarlas (por ejemplo con `bcrypt`) y usar sesiones firmadas.
- **Almacenamiento en la nube:** hoy los videos se guardan en `/public/uploads`. Eso
  funciona bien con `npm run dev`, pero para *producción* conviene almacenamiento de
  objetos (S3, Cloudflare R2, etc.), porque `public/` se congela al hacer `next build`.
- **Videos grandes:** para archivos muy pesados haría falta subida por partes (chunks).
  Para el MVP, usa videos de prueba de tamaño moderado.
- **Transcodificación / calidades:** si más adelante quieres que la calidad se adapte,
  ahí entra FFmpeg + HLS.
- **Miniaturas reales:** hoy se usa un frame del propio video como miniatura. Se pueden
  generar imágenes con FFmpeg.
