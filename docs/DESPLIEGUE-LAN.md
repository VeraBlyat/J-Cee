# Despliegue en LAN: frontend y backend en computadoras distintas

Guía completa para levantar UniStream repartido en **dos computadoras** de la
LAN `192.168.13.0/24` (la de Router3), todo con **Docker Compose**.

Está pensada para cumplir la rúbrica de *Tecnologías de la Virtualización, UA3*.
Al final hay un [mapeo punto por punto](#mapeo-con-la-rúbrica) y un
[banco de preguntas técnicas](#preguntas-técnicas-esperadas-20-pts).

---

## 1. Qué vamos a montar

```
                          Internet
                              ▲
                              │ OSPF (seriales 10.0.0.x)
                     ┌────────┴────────┐
                     │     Router3     │  192.168.13.1
                     │   DHCP + relay  │  reparte DNS = 192.168.13.10
                     └────────┬────────┘
                              │ Gi0/0/1
                     ┌────────┴────────┐
                     │     Switch3     │  192.168.13.2
                     └───┬─────────┬───┘
             Fa0/1       │         │      Fa0/2
        ┌────────────────┘         └────────────────┐
        ▼                                           ▼
┌────────────────────────┐  HTTPS 443    ┌────────────────────────────┐
│ PC-FRONT 192.168.13.20 │  ───────────► │  PC-BACK 192.168.13.10     │
│  unistream.lan         │  ◄─────────── │  api.unistream.lan         │
│                        │   TLS mutuo   │                            │
│ docker compose:        │   verificado  │ docker compose:            │
│  ├─ nginx  :443 (TLS)  │   con la CA   │  ├─ nginx  :443 (TLS)      │
│  └─ web    :3000 Next  │               │  ├─ api    :3001 Nest      │
│                        │               │  ├─ db     :5432 Postgres  │
│                        │               │  └─ dns    :53   dnsmasq   │
└────────────────────────┘               └────────────────────────────┘
      CAPA 1                                   CAPA 2 + CAPA 3
   presentación                            lógica + persistencia
```

**Las tres capas de la arquitectura:**

| Capa            | Dónde corre | Contenedor | Qué hace                                        |
| --------------- | ----------- | ---------- | ----------------------------------------------- |
| 1. Presentación | PC-FRONT    | `web`      | Next.js: renderiza la interfaz. No toca la BD.   |
| 2. Lógica / API | PC-BACK     | `api`      | Nest.js: reglas de negocio, sesiones, archivos.  |
| 3. Datos        | PC-BACK     | `db`       | PostgreSQL: usuarios, videos, comentarios.       |

La capa 3 **no publica ningún puerto al exterior**: solo existe dentro de la red
de Docker de PC-BACK y solo la alcanza el contenedor `api`. Esa es justamente la
gracia de una arquitectura de tres capas: la base de datos no es accesible desde
la red, ni siquiera desde PC-FRONT.

### Cómo viaja una petición

1. El navegador pide `https://unistream.lan/videos/1`.
2. El DNS de la LAN (dnsmasq en PC-BACK) responde `192.168.13.20`.
3. nginx de PC-FRONT termina el TLS y pasa la petición a Next.js.
4. Next.js, **desde el servidor**, llama a `https://api.unistream.lan/api/videos/1`
   (variable `INTERNAL_API_URL`) → sale de PC-FRONT, cruza el switch, entra a
   PC-BACK.
5. nginx de PC-BACK termina ese TLS y pasa a Nest.js.
6. Nest.js consulta PostgreSQL por la red interna de Docker y responde.
7. Ya en el navegador, las acciones del usuario (login, comentar, subir video)
   pegan a `https://unistream.lan/api/...`; nginx de PC-FRONT las reenvía a
   PC-BACK por HTTPS.

> **¿Por qué `/api` bajo el dominio del frontend y no directo al backend?**
> Para que el navegador vea **un solo origen**. Así la cookie de sesión
> `userId` viaja sin necesidad de `SameSite=None`, no hay peticiones
> *preflight* de CORS y el sitio funciona igual desde cualquier equipo de la
> LAN. La separación física entre front y back sigue siendo real: son dos
> computadoras distintas comunicándose por la red.

---

## 2. Antes de empezar

En **las dos** computadoras:

- Docker Desktop (Windows/macOS) o Docker Engine + plugin compose (Linux):
  `docker compose version` debe responder.
- Git, para clonar el repositorio: `git clone <url> && cd J-Cee`
- Estar conectadas por cable al **Switch3**.

En **una sola** (da igual cuál, o incluso tu laptop): `openssl`, para generar
los certificados.

---

## 3. Paso 1 — Configurar la red

### 3.1 Router y switch

Pega en la consola del Router3 el contenido de
[`deploy/red/Router3-actualizado.txt`](../deploy/red/Router3-actualizado.txt).
Respecto a tu configuración original de `LAN/Router(3).txt` cambian tres cosas:

1. **`clock rate 64000s` → `clock rate 64000`.** La `s` es un error de dedo: el
   comando se rechaza y el enlace serial se queda sin señal de reloj del lado
   DCE, o sea, caído.
2. **`ip dhcp excluded-address 192.168.13.1 192.168.13.30`** (antes excluía solo
   el `.1`). Reservamos el rango bajo para servidores con IP fija, para que el
   DHCP no le entregue el `.10` al celular de alguien y nos tumbe la API.
3. **`dns-server 192.168.13.10 8.8.8.8`** (antes solo `8.8.8.8`). Ahora el
   router reparte *nuestro* servidor DNS, así cualquier equipo que se conecte al
   switch resuelve `unistream.lan` sin tocar su archivo `hosts`. Se deja
   `8.8.8.8` como secundario para no quedarse sin internet si el contenedor DNS
   se cae.

También se le pone IP de administración al Switch3 (`192.168.13.2`), para poder
hacerle ping y demostrar conectividad de capa 2/3.

### 3.2 IP fija en las dos computadoras

Sigue [`deploy/red/ip-fija.md`](../deploy/red/ip-fija.md):

| Equipo   | IP              | Gateway        | DNS                        |
| -------- | --------------- | -------------- | -------------------------- |
| PC-BACK  | `192.168.13.10` | `192.168.13.1` | `127.0.0.1`, `8.8.8.8`     |
| PC-FRONT | `192.168.13.20` | `192.168.13.1` | `192.168.13.10`, `8.8.8.8` |

Ese documento también trae los comandos para **abrir el firewall** en los
puertos 443, 80 y 53. Es el error número uno en Windows: los contenedores
levantan bien pero desde la otra máquina "no se ve nada".

### 3.3 Comprobar

Desde PC-FRONT:

```bash
ping 192.168.13.1     # router
ping 192.168.13.2     # switch
ping 192.168.13.10    # PC-BACK
```

Si esto no pasa, no sigas: nada de lo demás va a funcionar.

---

## 4. Paso 2 — Generar los certificados TLS

Creamos una **Autoridad Certificadora propia** y con ella firmamos un
certificado para cada máquina.

```bash
cd deploy/tls
./generar-certificados.sh
```

Si usas otras IPs o dominios:

```bash
WEB_DOMAIN=misitio.lan API_DOMAIN=api.misitio.lan \
FRONTEND_IP=192.168.13.20 BACKEND_IP=192.168.13.10 \
./generar-certificados.sh
```

Esto deja en `deploy/tls/out/`:

| Archivo   | Qué es                                   | A dónde va                  |
| --------- | ---------------------------------------- | --------------------------- |
| `ca.crt`  | Certificado raíz de nuestra CA (público) | A **las dos** máquinas y a los navegadores |
| `ca.key`  | Llave privada de la CA                   | **No sale de tu equipo**    |
| `web.crt` + `web.key` | Certificado de `unistream.lan`     | PC-FRONT                    |
| `api.crt` + `api.key` | Certificado de `api.unistream.lan` | PC-BACK                     |

> **¿Por qué una CA y no un certificado auto-firmado suelto?** Con una CA
> instalas **un** certificado raíz en cada equipo y a partir de ahí confía en
> todos los que firmes. Es el mismo modelo de internet (Let's Encrypt,
> DigiCert), solo que acá la CA eres tú. Let's Encrypt no sirve en una LAN
> privada: no puede validar un dominio `.lan` ni una IP privada.

### Copiar los certificados

```bash
# En PC-FRONT (o copiándolos por USB / scp)
cp deploy/tls/out/para-frontend/* deploy/frontend/certs/

# En PC-BACK
cp deploy/tls/out/para-backend/*  deploy/backend/certs/
```

### Instalar la CA en los navegadores

Sin esto el navegador muestra "conexión no privada". Hay que hacerlo en **cada
equipo desde el que se vaya a abrir el sitio**, incluida la laptop del profesor.

- **Windows:** doble clic en `ca.crt` → *Instalar certificado* → *Equipo local* →
  *Colocar todos los certificados en el siguiente almacén* → **Entidades de
  certificación raíz de confianza**.
- **macOS:** doble clic → llavero *Sistema* → busca "UniStream LAN CA" → abre →
  *Confiar* → *Siempre confiar*.
- **Linux:** `sudo cp ca.crt /usr/local/share/ca-certificates/unistream-ca.crt && sudo update-ca-certificates`
- **Firefox** usa su propio almacén: `Ajustes → Privacidad y seguridad → Ver
  certificados → Autoridades → Importar`.

---

## 5. Paso 3 — Levantar la COMPUTADORA DEL BACKEND (PC-BACK)

```bash
cd deploy/backend
cp .env.example .env
```

Edita `.env` y **cambia `POSTGRES_PASSWORD`**. Luego:

```bash
docker compose up -d --build
```

Levanta cuatro contenedores:

| Servicio | Imagen              | Puerto publicado | Para qué                                    |
| -------- | ------------------- | ---------------- | ------------------------------------------- |
| `db`     | `postgres:16-alpine`| *ninguno*        | Base de datos (solo red interna de Docker)  |
| `api`    | build local         | *ninguno*        | API Nest.js                                 |
| `proxy`  | `nginx:1.27-alpine` | `443`, `80`      | TLS + entrada a la API                      |
| `dns`    | build local (alpine + dnsmasq) | `53/udp`, `53/tcp` | Resuelve `unistream.lan` para toda la LAN |

Detalles que vale la pena entender:

- **`depends_on: condition: service_healthy`**: el contenedor `api` no arranca
  hasta que `pg_isready` confirma que PostgreSQL acepta conexiones. Sin esto, la
  API se cae en el primer arranque porque intenta migrar contra una base que
  todavía está inicializándose.
- **Las migraciones corren solas.** `docker/backend-entrypoint.sh` ejecuta
  `scripts/migrate.js` antes de arrancar Nest. `schema.sql` usa
  `CREATE TABLE IF NOT EXISTS`, así que es idempotente: correrlo en cada
  arranque no rompe nada.
- **Volúmenes con nombre.** `db-data` (los datos) y `uploads` (los videos)
  sobreviven a `docker compose down` y a reconstruir la imagen. Solo se borran
  con `docker compose down -v`.
- **El DNS publica el puerto 53 en UDP *y* en TCP.** DNS usa UDP normalmente,
  pero se cambia a TCP cuando la respuesta no cabe en un paquete. Se publica el
  puerto en lugar de usar `network_mode: host` porque en Docker Desktop
  (Windows/macOS) el modo host no expone nada a la LAN real: los contenedores
  corren dentro de una máquina virtual Linux.

Comprueba:

```bash
docker compose ps                                  # los 4 arriba
curl --cacert certs/ca.crt https://api.unistream.lan/api/health
dig unistream.lan @127.0.0.1 +short                # -> 192.168.13.20
docker compose logs -f api                         # ver el arranque de Nest
```

---

## 6. Paso 4 — Levantar la COMPUTADORA DEL FRONTEND (PC-FRONT)

```bash
cd deploy/frontend
cp .env.example .env      # revisa que BACKEND_IP sea la correcta
docker compose up -d --build
```

Levanta dos contenedores: `web` (Next.js) y `proxy` (nginx con TLS).

Tres cosas de esta máquina merecen explicación:

1. **`BACKEND_ORIGIN` es un *build arg*, no una variable de runtime.** Los
   `rewrites()` de `next.config.mjs` se resuelven cuando corre `next build` y
   quedan escritos en `.next/routes-manifest.json`. Si cambias el dominio del
   backend, hay que **reconstruir** la imagen (`docker compose up -d --build`),
   no basta con reiniciar el contenedor.
2. **`NODE_EXTRA_CA_CERTS`.** Los componentes de servidor de Next hacen `fetch`
   contra `https://api.unistream.lan`. Node **no** usa el almacén de
   certificados del sistema operativo, trae el suyo propio; sin esta variable
   apuntando a nuestra `ca.crt`, ese fetch falla con *"unable to verify the
   first certificate"*.
3. **`extra_hosts`.** Le inyectamos `api.unistream.lan → 192.168.13.10` al
   `/etc/hosts` de los contenedores. Así el frontend sigue funcionando aunque el
   DNS se caiga, y el arranque no depende de en qué orden enciendas las
   máquinas.

Además, nginx de PC-FRONT valida el certificado del backend de verdad
(`proxy_ssl_verify on` con nuestra CA): si alguien suplantara a
`api.unistream.lan`, la conexión se rechaza.

---

## 7. Paso 5 — Verificar todo

Desde PC-FRONT (o desde cualquier equipo de la LAN con la CA instalada):

```bash
cd deploy
./verificar.sh
```

El script recorre la rúbrica en orden: ping al router y al switch, conectividad
entre las dos computadoras, resolución DNS, HTTPS en ambos servicios, redirección
de HTTP a HTTPS, y por último la cadena completa front → back → base de datos.

Y la prueba definitiva: abre `https://unistream.lan` en un navegador, regístrate,
sube un video y comenta. Ese flujo toca las tres capas y las dos computadoras.

---

## 8. Mapeo con la rúbrica

| Pts    | Requisito                                        | Cómo se cumple                                                                                              | Qué mostrar en la presentación                                     |
| ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **15** | La red está correctamente configurada y funcional | Router3 con OSPF y DHCP, Switch3 administrable, rango reservado para servidores | `show ip interface brief`, `show ip route ospf`, `show ip dhcp binding` |
| **10** | Existe comunicación entre los equipos de la red   | Las dos PCs en `192.168.13.0/24`, cada capa hablando con la siguiente                | `./verificar.sh`, `ping` cruzado, `tracert`                          |
| **15** | El servicio web está correctamente desplegado (Docker) | 6 contenedores en 2 `docker-compose.yml`, con healthchecks, volúmenes y restart automático | `docker compose ps`, `docker compose logs`, reiniciar una PC y ver que vuelve solo |
| **30** | Arquitectura front + back + BD con comunicación entre componentes | Next.js en PC-FRONT, Nest.js + PostgreSQL en PC-BACK; la BD sin puertos expuestos | Subir un video en el navegador y mostrar la fila con `docker compose exec db psql` |
| **10** | Dominio / DNS configurado y da acceso al servicio | dnsmasq sirve `unistream.lan` y `api.unistream.lan`; el router lo reparte por DHCP | `nslookup unistream.lan`, entrar desde un equipo que solo tomó DHCP  |
| **20** | Responder preguntas técnicas                      | Ver la siguiente sección                                                                                    | —                                                                    |
| **+10**| Certificado de seguridad en front-end y back-end  | CA propia; TLS en las dos máquinas, y además verificado entre ellas | Candado en el navegador, `openssl s_client`, mostrar `proxy_ssl_verify on` |

**Para el punto de 30:** demostrar que la base de datos está en la otra máquina
y que la comunicación es real:

```bash
# En PC-BACK, mientras alguien sube un video desde PC-FRONT
docker compose exec db psql -U unistream -d unistream -c "SELECT id, title, user_id FROM videos ORDER BY id DESC LIMIT 5;"

# Y que la BD NO es alcanzable desde afuera (esto DEBE fallar):
#   desde PC-FRONT
telnet 192.168.13.10 5432
```

---

## 9. Preguntas técnicas esperadas (20 pts)

**Docker**

- *¿Diferencia entre imagen y contenedor?* La imagen es la plantilla inmutable
  (capas de solo lectura); el contenedor es una instancia en ejecución con una
  capa escribible encima.
- *¿Por qué el Dockerfile tiene varias etapas (multi-stage)?* Para compilar con
  todas las dependencias de desarrollo y quedarnos solo con el resultado. La
  imagen final del backend lleva `dist/` y las dependencias de producción, no el
  compilador de TypeScript ni las de test. Menos peso y menos superficie de
  ataque.
- *¿Qué diferencia hay entre un volumen y un bind mount?* El volumen
  (`db-data`) lo administra Docker y sobrevive al contenedor; el bind mount
  (`./certs:/etc/nginx/certs:ro`) monta una carpeta del host. Usamos volúmenes
  para datos y bind mounts de solo lectura para configuración y certificados.
- *¿Qué hace `depends_on: condition: service_healthy`?* Espera a que el
  healthcheck del otro servicio pase. `depends_on` a secas solo espera a que el
  contenedor **arranque**, no a que el servicio de adentro esté listo.
- *¿Por qué la base de datos no publica puertos?* Porque solo la necesita el
  contenedor `api`, que la alcanza por el DNS interno de Docker (el nombre del
  servicio, `db`, resuelve a la IP del contenedor). No exponerla es la
  aplicación directa del principio de mínimo privilegio.
- *¿Qué pasa si se reinicia la computadora?* `restart: unless-stopped` levanta
  todo de nuevo, y los volúmenes conservan datos y videos.

**Red**

- *¿Por qué OSPF y no rutas estáticas?* OSPF es un protocolo de estado de enlace
  que se adapta solo: si cae un enlace serial, recalcula. Con rutas estáticas
  habría que reconfigurar a mano.
- *¿Para qué el `wildcard mask` 0.0.0.3 en `network 10.0.0.4 0.0.0.3`?* Es la
  máscara invertida de un `/30`: describe el enlace punto a punto entre dos
  routers (4 direcciones, 2 utilizables).
- *¿Por qué IP fija en los servidores y DHCP para los clientes?* Porque los
  certificados y el DNS apuntan a direcciones concretas. Los clientes no
  necesitan ser estables, los servidores sí.
- *¿Qué hace `ip dhcp excluded-address`?* Le dice al pool que no entregue ese
  rango, para que DHCP no choque con las IPs fijas.

**DNS**

- *¿Qué hace dnsmasq acá?* Es autoritativo para `unistream.lan` (responde con
  nuestras IPs) y reenvía todo lo demás a 8.8.8.8. El router lo anuncia por DHCP.
- *¿Por qué se publica el 53 en UDP y en TCP?* DNS trabaja normalmente sobre
  UDP (una consulta, un paquete), pero cambia a TCP cuando la respuesta no cabe
  en un datagrama o para transferencias de zona.
- *¿Qué diferencia hay entre `host-record` y `address=/dominio/`?*
  `host-record` crea el registro A **y** el PTR para un nombre exacto;
  `address=/unistream.lan/` atraparía también todos los subdominios, lo que
  chocaría con `api.unistream.lan`.

**TLS / seguridad**

- *¿Por qué no Let's Encrypt?* No puede emitir certificados para dominios `.lan`
  ni para IPs privadas: necesita validar que controlas un dominio público.
- *¿Qué es el SAN y por qué importa?* *Subject Alternative Name*. Los navegadores
  modernos ignoran el CN y solo miran el SAN; por eso el certificado incluye el
  dominio **y** la IP.
- *¿El tráfico entre las dos computadoras va cifrado?* Sí. nginx de PC-FRONT
  habla con PC-BACK por HTTPS y además **verifica** el certificado contra
  nuestra CA (`proxy_ssl_verify on`).

**CI/CD y GitHub Actions**

- *¿Qué automatizan los workflows?* Hay tres:
  `qa-front.yml` (lint + Jest + reporte de cobertura), `qa-back.yml` (levanta un
  PostgreSQL de servicio, migra, corre Jest y pruebas de integración con Newman)
  y `production.yml` (repite tests, construye la imagen Docker, la sube al Azure
  Container Registry y despliega, verificando `/api/health` al final).
- *¿Qué son las ramas `qa-front`, `qa-back` y `production`?* El flujo de trabajo:
  cada equipo integra en su rama de QA, y solo lo que pasa CI se mezcla a
  `production`, que es la que despliega.
- *¿Dónde se guardan las credenciales?* En *GitHub Secrets*
  (`ACR_PASSWORD`, `AZURE_CREDENTIALS`, …), nunca en el repositorio.
- *¿Cómo se relaciona el despliegue en LAN con el de Azure?* Es el mismo código
  con dos empaquetados: en Azure va un contenedor monolítico (`Dockerfile` de la
  raíz, front y back juntos porque App Service expone un solo puerto); en la LAN
  van dos imágenes separadas (`Dockerfile.frontend` y `Dockerfile.backend`) en
  dos máquinas.

**Sobre el propio proyecto**

- *¿Por qué el frontend no habla directo con PostgreSQL?* Porque violaría la
  separación en capas: expondría las credenciales de la BD en la máquina del
  frontend y cualquiera en la red podría llegar a los datos. Toda la lógica y el
  acceso a datos viven en el backend.
- *Limitación conocida:* las contraseñas se guardan en texto plano y la sesión
  es una cookie con el id del usuario (ver
  [ARQUITECTURA.md](./ARQUITECTURA.md)). Es un MVP académico; el siguiente paso
  sería hashear con bcrypt y firmar la sesión.

---

## 10. Problemas comunes

| Síntoma                                                       | Causa probable                                          | Solución                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Desde PC-FRONT no abre `https://api.unistream.lan`             | Firewall de Windows en PC-BACK                          | Abrir el puerto 443 (ver `deploy/red/ip-fija.md`)                        |
| `docker compose up` falla: *port 53 already in use*            | `systemd-resolved` (Ubuntu) o el cliente DNS de Windows | `DNSStubListener=no` en `/etc/systemd/resolved.conf` y reiniciar el servicio |
| El navegador dice "conexión no privada"                        | Falta instalar `ca.crt` en ese equipo                   | Instalar la CA (paso 4)                                                  |
| Next falla con *unable to verify the first certificate*        | Falta `NODE_EXTRA_CA_CERTS` o el `ca.crt` no está montado | Revisar que `deploy/frontend/certs/ca.crt` exista y recrear el contenedor |
| Cambié el dominio del backend y el frontend sigue con el viejo | Los rewrites son build-time                             | `docker compose up -d --build` en PC-FRONT                               |
| La API responde 500 al arrancar                                | La BD todavía no estaba lista                           | `docker compose logs api`; el entrypoint reintenta 60s, después aborta   |
| El video no se reproduce pero sí aparece en la lista           | El volumen `uploads` se borró                           | Los archivos viven en el volumen `uploads` de PC-BACK; `docker volume ls` |
| CORS bloquea las peticiones                                    | `FRONTEND_ORIGIN` no coincide con el dominio real       | Ajustar en `deploy/backend/.env` y reiniciar `api`                       |

### Comandos útiles

```bash
docker compose ps                 # estado y healthchecks
docker compose logs -f api        # seguir un servicio
docker compose restart proxy      # recargar nginx tras tocar la config
docker compose down               # bajar (conserva volúmenes)
docker compose down -v            # bajar Y BORRAR datos y videos
docker compose exec db psql -U unistream -d unistream   # entrar a la BD

# Ver el certificado que sirve una máquina
openssl s_client -connect api.unistream.lan:443 -servername api.unistream.lan </dev/null 2>/dev/null | openssl x509 -noout -subject -dates -ext subjectAltName
```
