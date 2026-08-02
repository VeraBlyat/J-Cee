# Despliegue

## Resumen

| Entorno | Base de datos | ¿Necesita algo a mano? |
| --- | --- | --- |
| **Local** | Tu Postgres | `npm run migrate` |
| **QA (CI)** | Contenedor `postgres:16` nuevo en cada corrida | Nada: nace vacía y `migrate` la arma entera |
| **Producción** | Azure Database for PostgreSQL, persistente | **Sí, una vez.** Ver abajo |

`docker/start.sh` corre `migrate.js` en cada arranque del contenedor, así que
las migraciones incrementales se aplican solas al desplegar.

---

## El reset de producción (una sola vez)

**Qué pasa si no se hace:** el esquema usa `CREATE TABLE IF NOT EXISTS`. Sobre
una base que ya tiene `users`, esa sentencia no hace nada, así que **la columna
`email` nunca se agrega**. La migración "termina bien" y después el login y el
registro fallan con `column "email" does not exist`.

**Por qué un reset y no una migración normal:** las contraseñas viejas estaban
en texto plano y ahora se guardan hasheadas con bcrypt. Un hash no se puede
reconstruir desde el texto plano después del hecho, y no hay flujo de
recuperación de contraseña todavía, así que los usuarios existentes quedarían
sin poder entrar igual. Se decidió que todos vuelvan a registrarse.

**Alcance:** borra las siete tablas del esquema — `users`, `videos`,
`comments`, `comment_votes`, `hashtags`, `video_hashtags` y `subscriptions`.

Tienen que ser todas. Si el reset dejara alguna afuera, el `DROP TABLE ...
CASCADE` de las demás le borra las *foreign keys* pero no sus filas, y
`schema.sql` tampoco la vuelve a crear porque usa `CREATE TABLE IF NOT EXISTS`.
Quedarían filas huérfanas apuntando a ids que el `SERIAL` va a reutilizar, y ya
sin la FK que lo impida: el primer video que se suba hereda los hashtags de un
video borrado, y las suscripciones apuntan a usuarios que no existen.

### Cómo correrlo

Desde `backend/`, apuntando a la base de producción:

```bash
DATABASE_URL='postgresql://USUARIO:CLAVE@SERVIDOR.postgres.database.azure.com:5432/BASE' \
DATABASE_SSL=true \
npm run db:reset -- --si-quiero-borrar-todo
```

La connection string está en los *app settings* del App Service, no en los
secrets del repo.

El script exige la bandera `--si-quiero-borrar-todo` a propósito, y antes de
borrar imprime **contra qué servidor y base** va a trabajar, además de cuántas
filas hay en cada tabla:

```
  Servidor : jcee-db.postgres.database.azure.com:5432
  Base     : jandcee
  Usuario  : jceeadmin

  comment_votes: 0 filas
  video_hashtags: 0 filas
  subscriptions: 0 filas
  comments: 31 filas
  videos: 4 filas
  hashtags: 0 filas
  users: 12 filas
```

Las tablas nuevas van a decir `0 filas` o `(no existe todavía)` la primera vez:
producción todavía corre el esquema viejo, así que es lo esperado.

Si esos datos no son los que esperabas, cortá con Ctrl+C antes de confirmar.
Equivocarse de entorno al pegar una connection string es el error caro de este
comando.

### Recuperar el primer admin

El reset deja `users` vacía, y eso incluye a los administradores. `is_admin`
sólo se cambia desde `PATCH /api/admin/users`, que está detrás de `AdminGuard`:
hace falta ser admin para nombrar a otro admin. Sobre una base recién reseteada
no hay ninguno, así que **el panel queda inaccesible hasta que se nombre al
primero a mano**.

Para eso está `db:make-admin`. Se corre una sola vez, después de registrar la
primera cuenta desde la web:

```bash
DATABASE_URL='postgresql://USUARIO:CLAVE@SERVIDOR.postgres.database.azure.com:5432/BASE' \
DATABASE_SSL=true \
npm run db:make-admin -- tu-email@ejemplo.com
```

El email se normaliza igual que en el registro (sin espacios y en minúsculas),
así que no importa cómo lo escribas. Si no hay ningún usuario con ese email, el
script avisa y no toca nada. De ahí en adelante los admins se nombran desde el
panel, como siempre.

### Orden recomendado

1. Correr el reset contra producción **antes** de desplegar la imagen nueva.
   Así la ventana en la que la app vieja convive con el esquema nuevo dura lo
   mínimo.
2. Hacer push a `production` y dejar que el pipeline despliegue.
3. Verificar `/api/health` (el propio workflow ya lo hace) y registrar la
   cuenta que va a ser la de administración.
4. Correr `db:make-admin` con ese email y confirmar que `/admin` responde.

De acá en adelante **no hace falta ningún reset más**: todas las migraciones
posteriores (HLS, miniaturas, hashtags, suscripciones, comentarios) usan
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, que es idempotente y no destruye
datos.

---

## FFmpeg

El backend lo invoca como proceso externo para leer metadata al subir
(`ffprobe`), generar miniaturas y transcodificar los segmentos HLS bajo
demanda. Es dependencia de **runtime**, no de build.

- **Producción:** el `Dockerfile` hace `apk add --no-cache ffmpeg` en la etapa
  de runtime, y verifica en el build que existan los dos binarios. Si el
  paquete de Alpine dejara de traerlos, el build falla ahí en vez de romper en
  producción.
- **QA:** el workflow instala `ffmpeg` con apt.
- **Local:** instalalo con el gestor de paquetes de tu sistema.

Sin FFmpeg, subir un video devuelve *"El archivo no es un video válido"* y el
streaming responde 500.

---

## Variables de entorno del backend

| Variable | Default | Para qué |
| --- | --- | --- |
| `DATABASE_URL` | — | Conexión a Postgres. Obligatoria. |
| `DATABASE_SSL` | `false` | `true` contra Azure, que exige SSL. |
| `PORT` | `3001` | Puerto del backend. |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Origen permitido por CORS. |
| `HLS_MAX_CONCURRENT` | `2` | Tope de FFmpeg simultáneos. |
| `HLS_CACHE_MAX_BYTES` | `2 GB` | Tamaño máximo de la caché de segmentos. |

En producción sólo hacen falta las dos primeras. `PORT` lo inyecta App Service,
`FRONTEND_ORIGIN` no se usa porque el navegador le pega a `/api` en el mismo
origen (Next hace de proxy hacia el backend, que sólo escucha en localhost
dentro del contenedor), y los dos límites de HLS tienen defaults razonables.

### App settings del App Service

| Setting | Valor |
| --- | --- |
| `DATABASE_URL` | La connection string de Azure Database for PostgreSQL. |
| `DATABASE_SSL` | `true`. Azure rechaza las conexiones sin SSL. |
| `WEBSITES_PORT` | `8080`, el mismo que expone el Dockerfile. |

Si el sitio queda en "Application Error" apenas despliega, mirá primero
`WEBSITES_PORT`: App Service asume el 80 y el contenedor escucha en el 8080.

### Secrets del repositorio

Los usa `.github/workflows/production.yml`. Sin alguno de estos el pipeline
falla en el job correspondiente, no en el deploy:

| Secret | Job |
| --- | --- |
| `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD` | `docker-build-push` |
| `AZURE_CREDENTIALS`, `AZURE_WEBAPP_NAME` | `deploy-azure` |

`deploy-azure` corre sobre el *environment* `production` de GitHub: si tiene
revisores configurados, el deploy queda esperando aprobación después del push.

---

## Almacenamiento efímero

Tanto `backend/uploads/` (los videos originales) como `backend/hls-cache/`
(los segmentos generados) viven en el sistema de archivos del contenedor. En
Azure App Service eso **se pierde en cada redespliegue o reinicio**.

Para la caché HLS no es problema: se regenera sola bajo demanda, que es
justamente el punto del enfoque JIT. Para los videos subidos **sí lo es**:
después de un redespliegue las filas quedan en la base pero los archivos ya no
están. Moverlos a Azure Blob Storage es el pendiente para que producción
soporte contenido real.
