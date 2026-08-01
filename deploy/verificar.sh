#!/usr/bin/env bash
#
# Comprobación de extremo a extremo del despliegue en LAN.
# Corre esto ANTES de presentar: recorre, en orden, cada punto de la rúbrica.
#
#   ./verificar.sh              (usa los valores por defecto)
#   BACKEND_IP=10.0.0.5 ./verificar.sh
#
set -uo pipefail

GATEWAY="${GATEWAY:-192.168.13.1}"
SWITCH="${SWITCH:-192.168.13.2}"
BACKEND_IP="${BACKEND_IP:-192.168.13.10}"
FRONTEND_IP="${FRONTEND_IP:-192.168.13.20}"
WEB_DOMAIN="${WEB_DOMAIN:-unistream.lan}"
API_DOMAIN="${API_DOMAIN:-api.unistream.lan}"
CA="${CA:-$(dirname "$0")/tls/out/ca.crt}"

ok=0; fail=0

titulo() { printf "\n\033[1m== %s\033[0m\n" "$1"; }
probar() {
  local descripcion="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf "  \033[32m[OK]\033[0m   %s\n" "$descripcion"; ok=$((ok + 1))
  else
    printf "  \033[31m[FALLA]\033[0m %s\n" "$descripcion"
    printf "         comando: %s\n" "$*"; fail=$((fail + 1))
  fi
}

# --- Rúbrica 1: la red está configurada y es funcional --------------------
titulo "1. Red (15 pts)"
probar "Ping al gateway (Router3 $GATEWAY)"      ping -c 2 -W 2 "$GATEWAY"
probar "Ping al switch ($SWITCH)"                ping -c 2 -W 2 "$SWITCH"
probar "Salida a internet (8.8.8.8)"             ping -c 2 -W 2 8.8.8.8

# --- Rúbrica 2: comunicación entre los equipos ----------------------------
titulo "2. Comunicación entre equipos (10 pts)"
probar "Ping a PC-BACK ($BACKEND_IP)"            ping -c 2 -W 2 "$BACKEND_IP"
probar "Ping a PC-FRONT ($FRONTEND_IP)"          ping -c 2 -W 2 "$FRONTEND_IP"
probar "Puerto 443 abierto en PC-BACK"           bash -c "</dev/tcp/$BACKEND_IP/443"
probar "Puerto 443 abierto en PC-FRONT"          bash -c "</dev/tcp/$FRONTEND_IP/443"

# --- Rúbrica 5: DNS --------------------------------------------------------
titulo "5. DNS / dominio (10 pts)"
if command -v dig >/dev/null 2>&1; then
  probar "$WEB_DOMAIN resuelve a $FRONTEND_IP" \
    bash -c "dig +short $WEB_DOMAIN @$BACKEND_IP | grep -qx $FRONTEND_IP"
  probar "$API_DOMAIN resuelve a $BACKEND_IP" \
    bash -c "dig +short $API_DOMAIN @$BACKEND_IP | grep -qx $BACKEND_IP"
else
  probar "$WEB_DOMAIN resuelve (getent)"  bash -c "getent hosts $WEB_DOMAIN"
  probar "$API_DOMAIN resuelve (getent)"  bash -c "getent hosts $API_DOMAIN"
  echo "         (instala 'dig' — dnsutils/bind-utils — para probar el DNS directo)"
fi

# --- Rúbrica 3 y 6: servicio desplegado y TLS ------------------------------
titulo "3 y 6. Servicio web + certificados (15 pts + 10 extra)"
CURL_CA=()
if [[ -f "$CA" ]]; then
  CURL_CA=(--cacert "$CA")
else
  CURL_CA=(-k)
  echo "  (aviso: no encontré la CA en $CA — se valida sin verificar el certificado)"
fi

probar "HTTPS del frontend responde"  curl -fsS "${CURL_CA[@]}" "https://$WEB_DOMAIN/"
probar "Certificado del frontend válido para $WEB_DOMAIN" \
  curl -fsS --cacert "$CA" "https://$WEB_DOMAIN/"
probar "HTTPS del backend responde (health)" \
  curl -fsS "${CURL_CA[@]}" "https://$API_DOMAIN/api/health"
probar "HTTP redirige a HTTPS" \
  bash -c "curl -sSI http://$WEB_DOMAIN/ | grep -q '301'"

# --- Rúbrica 4: arquitectura de 3 capas comunicándose ----------------------
titulo "4. Arquitectura front + back + BD (30 pts)"
probar "Front -> Back: /api/health a través del frontend" \
  curl -fsS "${CURL_CA[@]}" "https://$WEB_DOMAIN/api/health"
probar "Back -> BD: /api/videos devuelve JSON desde PostgreSQL" \
  bash -c "curl -fsS ${CURL_CA[*]} https://$WEB_DOMAIN/api/videos | grep -q '^\['"

# --- Resumen ---------------------------------------------------------------
printf "\n\033[1m== Resumen ==\033[0m\n"
printf "  Pruebas OK:     %d\n" "$ok"
printf "  Pruebas fallidas: %d\n" "$fail"
if [[ "$fail" -eq 0 ]]; then
  printf "\n\033[32mTodo en orden.\033[0m\n"
  exit 0
fi
printf "\n\033[31mHay pruebas fallidas — revisa docs/DESPLIEGUE-LAN.md (sección Problemas comunes).\033[0m\n"
exit 1
