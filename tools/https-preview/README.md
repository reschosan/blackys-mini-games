# HTTPS preview for real phones

Browsers allow camera access only on HTTPS pages. The host phone needs its camera for "Invite players" (milestone 10b), so this container serves the production build (`dist/`) over HTTPS on the local network. Caddy creates a certificate with its local certificate authority. This is a local testing tool, not a deployment.

## Start

```bash
tools/https-preview/start.sh              # build the game and run in the foreground with logs
tools/https-preview/start.sh --no-build   # use an existing, current dist/ build
tools/https-preview/start-d.sh            # run in the background (also accepts --no-build)
tools/https-preview/stop.sh               # stop the background preview; --all also removes the certificate
```

The scripts find the LAN address and computer name on macOS and Linux, including Raspberry Pi. To set them yourself, run `HOST_ADDRESS=192.168.1.20 HOST_NAME=raspberrypi tools/https-preview/start.sh`. The certificate covers the IP address, the computer name, and `name.local`. Restart after the address changes. `start.sh` removes its container when stopped with Ctrl+C.

`common.sh` contains the shared Docker checks, address lookup, and build steps. The start scripts source it; do not run it directly. You can also build and start manually: `npm run build`, then `HOST_ADDRESS=<lan-ip> docker compose -f tools/https-preview/docker-compose.yaml up -d`.

The default port is 8745. For another port, set `HTTPS_PORT=<port>` before starting and replace `8745` in `Caddyfile`. Open `https://<HOST_ADDRESS>:8745/` on the phones. All devices must be on the same Wi-Fi network; guest networks may block connections between devices.

## Trust the certificate on your phone (once)

Without this step, the browser shows a warning. Android Chrome may allow the camera after you proceed, but iPhone browsers require the certificate to be trusted. Copy Caddy's local root certificate:

```bash
docker compose -f tools/https-preview/docker-compose.yaml cp https-preview:/data/caddy/pki/authorities/local/root.crt tools/https-preview/root.crt
```

Send `root.crt` to the iPhone with AirDrop, open it, install the downloaded profile in Settings, then enable trust under Settings › General › About › Certificate Trust Settings. On Android, use Settings › Security › Install a certificate (CA certificate). Install this certificate only for local testing and remove it afterwards.

## Clean up

```bash
tools/https-preview/stop.sh --all   # remove the container and certificate volume
```
