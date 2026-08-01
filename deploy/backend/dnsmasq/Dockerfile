# Servidor DNS de la LAN. Alpine + dnsmasq, nada más.
# La configuración se monta como volumen desde docker-compose.yml.
FROM alpine:3.20

RUN apk add --no-cache dnsmasq

EXPOSE 53/udp 53/tcp

# -k        : no hacer fork, quedarse en primer plano (lo que espera Docker).
# --log-facility=- : logs a stdout, para verlos con `docker compose logs dns`.
ENTRYPOINT ["dnsmasq", "-k", "--log-facility=-", "--conf-file=/etc/dnsmasq.conf"]
