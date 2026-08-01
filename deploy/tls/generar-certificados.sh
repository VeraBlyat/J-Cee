#!/usr/bin/env bash
#
# Genera una Autoridad Certificadora (CA) propia para la LAN y dos
# certificados firmados por ella: uno para el frontend y otro para el backend.
#
# ¿Por qué una CA propia y no un certificado auto-firmado suelto?
#   - Con una CA, instalas UN solo certificado raíz en los navegadores/equipos
#     y a partir de ahí confían en TODOS los certificados que firmes.
#   - Es exactamente el mismo modelo que usa internet (Let's Encrypt, DigiCert),
#     solo que acá la CA sos vos. Let's Encrypt no sirve en una LAN privada
#     porque no puede validar dominios .lan ni IPs privadas.
#
# Uso:
#   ./generar-certificados.sh            (usa los valores por defecto)
#   WEB_DOMAIN=mi.lan ./generar-certificados.sh
#
set -euo pipefail

cd "$(dirname "$0")"

# --- Parámetros (se pueden sobreescribir por variables de entorno) ---------
WEB_DOMAIN="${WEB_DOMAIN:-unistream.lan}"
API_DOMAIN="${API_DOMAIN:-api.unistream.lan}"
FRONTEND_IP="${FRONTEND_IP:-192.168.13.20}"
BACKEND_IP="${BACKEND_IP:-192.168.13.10}"
DIAS="${DIAS:-825}"   # 825 días: el máximo que aceptan Chrome/Safari.

OUT="out"
mkdir -p "$OUT"

echo "==> Generando certificados en $(pwd)/$OUT"
echo "    Frontend: $WEB_DOMAIN ($FRONTEND_IP)"
echo "    Backend : $API_DOMAIN ($BACKEND_IP)"
echo

# --- 1. La CA raíz --------------------------------------------------------
if [[ -f "$OUT/ca.key" ]]; then
  echo "==> Ya existe una CA en $OUT/ca.key, la reutilizo."
else
  echo "==> Creando la CA raíz (UniStream LAN CA)..."
  openssl genrsa -out "$OUT/ca.key" 4096
  openssl req -x509 -new -nodes \
    -key "$OUT/ca.key" \
    -sha256 -days 3650 \
    -subj "/C=MX/ST=Baja California/L=Tijuana/O=UniStream/CN=UniStream LAN CA" \
    -out "$OUT/ca.crt"
fi

# --- 2. Función que emite un certificado de servidor ----------------------
emitir_cert() {
  local nombre="$1" cn="$2" ip="$3" alt_dns="$4"

  echo "==> Emitiendo certificado '$nombre' para $cn ..."

  # SAN (Subject Alternative Name): los navegadores modernos IGNORAN el CN y
  # solo miran esta lista. Incluimos el dominio y la IP para poder probar de
  # las dos formas.
  cat > "$OUT/$nombre.cnf" <<EOF
[req]
distinguished_name = dn
req_extensions     = ext
prompt             = no

[dn]
C  = MX
ST = Baja California
L  = Tijuana
O  = UniStream
CN = $cn

[ext]
subjectAltName   = DNS:$cn, DNS:$alt_dns, IP:$ip
keyUsage         = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF

  openssl genrsa -out "$OUT/$nombre.key" 2048
  openssl req -new -key "$OUT/$nombre.key" -out "$OUT/$nombre.csr" -config "$OUT/$nombre.cnf"
  openssl x509 -req \
    -in "$OUT/$nombre.csr" \
    -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" -CAcreateserial \
    -out "$OUT/$nombre.crt" \
    -days "$DIAS" -sha256 \
    -extfile "$OUT/$nombre.cnf" -extensions ext

  rm -f "$OUT/$nombre.csr"
}

# "localhost" como DNS alterno permite probar el contenedor en la propia
# máquina antes de tocar la red.
emitir_cert "web" "$WEB_DOMAIN" "$FRONTEND_IP" "localhost"
emitir_cert "api" "$API_DOMAIN" "$BACKEND_IP" "localhost"

# --- 3. Reparto -----------------------------------------------------------
mkdir -p "$OUT/para-frontend" "$OUT/para-backend"
cp "$OUT/web.crt" "$OUT/web.key" "$OUT/ca.crt" "$OUT/para-frontend/"
cp "$OUT/api.crt" "$OUT/api.key" "$OUT/ca.crt" "$OUT/para-backend/"

chmod 600 "$OUT"/*.key "$OUT"/para-*/*.key

echo
echo "==> Listo."
echo
echo "   Copia a la COMPUTADORA DEL FRONTEND -> deploy/frontend/certs/"
echo "     $OUT/para-frontend/{web.crt, web.key, ca.crt}"
echo
echo "   Copia a la COMPUTADORA DEL BACKEND  -> deploy/backend/certs/"
echo "     $OUT/para-backend/{api.crt, api.key, ca.crt}"
echo
echo "   Instala $OUT/ca.crt como 'Entidad de certificación raíz de confianza'"
echo "   en cada computadora que vaya a abrir el sitio (incluida la del profe)."
echo
echo "   Verifica un certificado con:"
echo "     openssl x509 -in $OUT/web.crt -noout -text | grep -A1 'Subject Alternative Name'"
