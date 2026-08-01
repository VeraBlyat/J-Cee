# Poner IP fija a las dos computadoras

El DHCP del Router3 entrega direcciones de `192.168.13.31` en adelante. Las dos
computadoras del proyecto llevan **IP fija** dentro del rango reservado
(`.1`–`.30`), porque el DNS y los certificados apuntan a direcciones concretas:
si cambian al reiniciar, se rompe todo.

| Equipo     | IP              | Máscara         | Gateway        | DNS                        |
| ---------- | --------------- | --------------- | -------------- | -------------------------- |
| PC-BACK    | `192.168.13.10` | `255.255.255.0` | `192.168.13.1` | `127.0.0.1`, `8.8.8.8`     |
| PC-FRONT   | `192.168.13.20` | `255.255.255.0` | `192.168.13.1` | `192.168.13.10`, `8.8.8.8` |

> PC-BACK se apunta a sí misma como DNS (`127.0.0.1`) porque es la que corre
> dnsmasq.

---

## Windows

Interfaz gráfica: `Configuración → Red e Internet → Ethernet → Editar
configuración IP → Manual → IPv4 activado`.

O en PowerShell **como administrador** (cambia `"Ethernet"` por el nombre real
de tu adaptador, que ves con `Get-NetAdapter`):

```powershell
# --- PC-BACK ---
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.13.10 `
  -PrefixLength 24 -DefaultGateway 192.168.13.1
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" `
  -ServerAddresses 127.0.0.1,8.8.8.8

# --- PC-FRONT ---
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.13.20 `
  -PrefixLength 24 -DefaultGateway 192.168.13.1
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" `
  -ServerAddresses 192.168.13.10,8.8.8.8
```

Además hay que **abrir el firewall** para los puertos que publicamos:

```powershell
New-NetFirewallRule -DisplayName "UniStream HTTPS" -Direction Inbound `
  -Protocol TCP -LocalPort 443 -Action Allow
New-NetFirewallRule -DisplayName "UniStream HTTP"  -Direction Inbound `
  -Protocol TCP -LocalPort 80  -Action Allow
# Solo en PC-BACK (servidor DNS):
New-NetFirewallRule -DisplayName "UniStream DNS" -Direction Inbound `
  -Protocol UDP -LocalPort 53 -Action Allow
```

## Linux (NetworkManager)

```bash
# --- PC-BACK ---
sudo nmcli con mod "Wired connection 1" \
  ipv4.addresses 192.168.13.10/24 \
  ipv4.gateway 192.168.13.1 \
  ipv4.dns "127.0.0.1 8.8.8.8" \
  ipv4.method manual
sudo nmcli con up "Wired connection 1"
```

En Ubuntu, `systemd-resolved` ya ocupa el puerto 53 y choca con dnsmasq. Si
`docker compose up` falla con *address already in use*:

```bash
sudo sed -i 's/^#\?DNSStubListener=.*/DNSStubListener=no/' /etc/systemd/resolved.conf
sudo systemctl restart systemd-resolved
```

## macOS

`Ajustes del sistema → Red → Ethernet → Detalles → TCP/IP → Configurar IPv4:
Manualmente`, y en la pestaña `DNS` agrega los servidores de la tabla.

---

## Plan B: archivo `hosts`

Si el DNS no coopera el día de la demostración, cualquier equipo puede resolver
los nombres a mano. **No sustituye al punto de DNS de la rúbrica**, pero salva
la presentación.

- Windows: `C:\Windows\System32\drivers\etc\hosts` (Bloc de notas como admin)
- Linux / macOS: `/etc/hosts` (con `sudo`)

```
192.168.13.20   unistream.lan
192.168.13.10   api.unistream.lan
```
