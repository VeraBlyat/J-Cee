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

**Alcance:** borra usuarios, videos, comentarios, suscripciones y hashtags.

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

  users: 12 filas
  videos: 4 filas
  comments: 31 filas
```

Si esos datos no son los que esperabas, cortá con Ctrl+C antes de confirmar.
Equivocarse de entorno al pegar una connection string es el error caro de este
comando.

### Orden recomendado

1. Correr el reset contra producción **antes** de desplegar la imagen nueva.
   Así la ventana en la que la app vieja convive con el esquema nuevo dura lo
   mínimo.
2. Hacer push a `production` y dejar que el pipeline despliegue.
3. Verificar `/api/health` (el propio workflow ya lo hace) y registrar una
   cuenta de prueba.

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
