---
status: draft
last-verified: 2026-09-30
---

# Deploy

How the game gets onto its VPS and stays current. Why it is built this way: [hosting and deploy](design-docs/hosting-and-deploy.md). Commands marked *owner machine* run in the repo on the development machine; the others run on the VPS over SSH. Real hostnames, addresses and folders go in `.env` files, never in this doc.

## What runs where
- **The VPS** runs `deploy/compose.yml`: Caddy on ports 80 and 443 with the Let's Encrypt certificate for `YSTO_DOMAIN`, and the game's image from GHCR, which publishes no port. The exported library and the catalog are mounted read-only.
- **GitHub** builds and publishes the image when the owner starts the release workflow. It holds no credentials for the VPS.
- **The owner machine** builds the catalog and exports the library, then sends both with `rsync`.

## One-time setup
### 1. The server
- Hetzner Cloud: Ubuntu 24.04, type CX23 (2 x86 vCPUs, 4 GB) or CAX11 (2 Arm vCPUs, 4 GB). The image runs on both. Add your SSH public key when you create it, and give it an IPv4 and an IPv6 address.
- Attach a Hetzner Cloud Firewall that allows inbound TCP 22, 80 and 443, and UDP 443 (HTTP/3), and nothing else.
- At your DNS provider, point an `A` record for the domain at the server's IPv4 address and an `AAAA` record at its IPv6 address. Caddy can only get the certificate once they resolve.

### 2. Harden it
Log in as root once, then:
```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
passwd deploy
rsync -a /root/.ssh ~deploy/ && chown -R deploy:deploy ~deploy/.ssh
printf 'PasswordAuthentication no\nPermitRootLogin no\n' > /etc/ssh/sshd_config.d/99-ysto.conf
systemctl reload ssh
apt update && apt full-upgrade -y
apt install -y unattended-upgrades docker.io docker-compose-v2
dpkg-reconfigure -plow unattended-upgrades
usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
```
From here on, log in as `deploy`. Check that `ssh root@<server>` is refused before you log out of the root session. Docker's published ports bypass ufw, which is why only Caddy publishes any.

### 3. Folders and settings
```bash
sudo mkdir -p /opt/ysto /srv/ysto/audio /srv/ysto/catalog
sudo chown -R deploy:deploy /opt/ysto /srv/ysto
```
*Owner machine*: copy the deploy files over, with a `.env` made from `deploy/.env.example`:
```bash
scp deploy/compose.yml deploy/Caddyfile deploy@<server>:/opt/ysto/
scp deploy/.env.example deploy@<server>:/opt/ysto/.env
```
On the VPS, set `YSTO_DOMAIN` in `/opt/ysto/.env`. The folder defaults match the ones created above.

### 4. The library and the catalog
*Owner machine* (rsync runs in WSL on Windows):
```bash
npm run catalog:export
rsync -av --delete --chmod=D755,F644 "$YSTO_EXPORT_DIR/" deploy@<server>:/srv/ysto/audio/
rsync -av --delete --chmod=D755,F644 data/catalog/ deploy@<server>:/srv/ysto/catalog/
```
- `catalog:export` re-encodes every file the catalog plays to 128 kbps Opus in `YSTO_EXPORT_DIR` (default `data/export/`), at the same relative paths. It skips files already exported, so the first run takes a while and later runs take seconds.
- The container runs as uid 1000, so the files must be readable by everyone, hence `--chmod`.

### 5. The image
The first release makes the GHCR package `ghcr.io/xms61/ysto`. It is private at first: in its package settings on GitHub, set the visibility to public once. The image holds no audio, catalog or secret, and CI checks this.

### 6. First start
```bash
cd /opt/ysto
docker compose pull
docker compose up -d
docker compose ps
curl -fsS https://<domain>/readyz
```
`readyz` answers `{"status":"ready"}` once the catalog, the audio folder and ffmpeg all work. If it doesn't, `docker compose logs ysto` names the reason (`catalog.unavailable`, `audio.unavailable` or `ffmpeg.unavailable`), and `docker compose logs caddy` shows certificate problems.

## Checks after setup
These are M8's "Done when" checks:
- Play a whole game at `https://<domain>` from a phone and a computer.
- Time the clips on the VPS. The target is a 30 s clip in under 500 ms at the 95th percentile ([RELIABILITY.md](RELIABILITY.md#performance)):
  ```bash
  docker compose run --rm --no-deps ysto node scripts/clips/bench.ts
  ```
  If it misses, move to the 4-vCPU type (CX33 or CAX21) in the Hetzner console. That keeps the disk and the address.
- *Owner machine*: scan the ports from outside. Only 22, 80 and 443 may be open:
  ```bash
  nmap -Pn -p- <domain>
  ```

## Routines
### Release and update
1. Merge the PR with the version bump and its CHANGELOG entry.
2. *Owner machine*: start the release from main: `gh workflow run release.yml -f version=<version>`. It reruns CI, publishes `ghcr.io/xms61/ysto:<version>` and `:latest` for amd64 and arm64, tags `v<version>` and creates the GitHub release.
3. On the VPS: `cd /opt/ysto && docker compose pull && docker compose up -d`. Running games end with a notice, which is why this waits for a quiet moment.

To roll back, set `YSTO_VERSION=<older version>` in `/opt/ysto/.env` and run `docker compose up -d`. Remove it again to follow `latest`.

### A new catalog or library
Rebuild on the owner machine ([CATALOG.md](../scripts/catalog/CATALOG.md)), rerun step 4, then `docker compose restart ysto`. The server reads the catalog only at startup.

### Deploy files
When `deploy/compose.yml` or `deploy/Caddyfile` changes in a release, copy it over again (step 3) before `docker compose up -d`.

### Logs and disk
- `docker compose logs -f ysto`: the game's JSON log lines ([RELIABILITY.md](RELIABILITY.md#logging)). Docker keeps 3 files of 10 MB per service.
- `docker image prune -f` after updates removes old images.
- Nothing on the VPS needs a backup: the library and the catalog come from the owner machine, and Caddy gets a new certificate if its volume is lost.
