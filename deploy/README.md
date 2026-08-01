# `deploy/` — Despliegue en LAN con Docker Compose

Frontend en una computadora, backend + base de datos en otra, dentro de la LAN
`192.168.13.0/24` de Router3.

**La guía completa paso a paso está en
[`docs/DESPLIEGUE-LAN.md`](../docs/DESPLIEGUE-LAN.md).** Esto es solo el índice.

```
deploy/
├── tls/
│   └── generar-certificados.sh   Crea la CA de la LAN y los certificados
├── backend/                      -> COPIAR A PC-BACK (192.168.13.10)
│   ├── docker-compose.yml        db + api + nginx + dns
│   ├── .env.example              contraseña de PostgreSQL, dominios, CORS
│   ├── nginx/api.conf.template   TLS + proxy a Nest
│   ├── dnsmasq/dnsmasq.conf      zona unistream.lan
│   └── certs/                    api.crt, api.key, ca.crt  (no van a git)
├── frontend/                     -> COPIAR A PC-FRONT (192.168.13.20)
│   ├── docker-compose.yml        web + nginx
│   ├── .env.example              dominios e IP del backend
│   ├── nginx/web.conf.template   TLS + proxy a Next y a la API remota
│   └── certs/                    web.crt, web.key, ca.crt  (no van a git)
├── red/
│   ├── Router3-actualizado.txt   Config Cisco con DHCP + DNS interno
│   └── ip-fija.md                IP estática y firewall en cada SO
└── verificar.sh                  Comprueba la rúbrica de punta a punta
```

## Resumen rápido

```bash
# 0. En cualquier máquina: certificados
cd deploy/tls && ./generar-certificados.sh

# 1. PC-BACK (192.168.13.10)
cd deploy/backend
cp .env.example .env          # cambia POSTGRES_PASSWORD
cp ../tls/out/para-backend/* certs/
docker compose up -d --build

# 2. PC-FRONT (192.168.13.20)
cd deploy/frontend
cp .env.example .env
cp ../tls/out/para-frontend/* certs/
docker compose up -d --build

# 3. Verificar
cd deploy && ./verificar.sh
```

Después: `https://unistream.lan`

> Los archivos `.env` y todo lo que hay en `certs/` y `tls/out/` están en
> `.gitignore`: contienen contraseñas y llaves privadas.
