---
status: draft
last-verified: 2026-10-06
---

# Deploy

How the game gets onto its VPS and stays current. Why it is built this way: [hosting and deploy](design-docs/hosting-and-deploy.md). Commands marked *owner machine* run in the repo on the development machine; the others run on the VPS over SSH. Real hostnames, addresses and folders go in `.env` files, never in this doc.

## Status
Deployed. The owner's Hetzner VPS has served the game on its domain since 0.13.0 (2026-09-30), set up by this runbook ([v1 plan](exec-plans/completed/2026-09-25-ysto-v1.md), M8). On 2026-10-05 it answered `/readyz`, sent every security header, redirected HTTP to HTTPS, and refused socket upgrades from another origin or none. Two of the [checks after setup](#checks-after-setup) still wait for the owner, under [Open checks](#open-checks). Updates follow [Release and update](#release-and-update).

## What runs where
- **The VPS** runs `deploy/compose.yml`: Caddy on ports 80 and 443 with the Let's Encrypt certificate for `YSTO_DOMAIN`, and the game's image from GHCR, which publishes no port. The exported library and the catalog are mounted read-only. The one writable mount is the `ysto_state` volume at `/data/state`, where the game keeps the players' clip reports.
- **GitHub** builds and publishes the image when the owner starts the release workflow. It holds no credentials for the VPS.
- **The owner machine** builds the catalog and exports the library, then sends both with `rsync`.

## One-time setup
### 1. The server
- Hetzner Cloud: Ubuntu 24.04, type CX23 (2 x86 vCPUs, 4 GB) or CAX11 (2 Arm vCPUs, 4 GB). The image runs on both. Add your SSH public key when you create it, and give it an IPv4 and an IPv6 address.
- Attach a Hetzner Cloud Firewall that allows inbound TCP 22, 80 and 443, and UDP 443 (HTTP/3), and nothing else.
- Set up the domain as in [The domain](#the-domain). Caddy can only get the certificate once it resolves.

### The domain
The game is served on a domain over HTTPS, never on the bare IP. Hetzner hosts the server; the domain comes from a registrar (Porkbun, Cloudflare Registrar, INWX, Namecheap, or Hetzner's own), with WHOIS privacy on. A subdomain of a domain you already own works too.
- At the registrar's DNS, add an `A` record for the name (such as `quiz`, or `@` for the bare domain) with the server's IPv4 address, and an `AAAA` record with its IPv6 address, both from the Hetzner Cloud Console. A TTL of 300 s is fine while setting up.
- Keeping DNS at the registrar is simplest. To use Hetzner's free DNS instead, create the zone in the Hetzner Console, add the same records, and set the domain's nameservers at the registrar to Hetzner's.
- On Cloudflare, the records must be **DNS only** (grey cloud). Its proxy would add a hop in front of Caddy: the game would see Cloudflare's addresses instead of the players', which breaks the per-IP limits, and Caddy's certificate challenge can fail.
- Check with `nslookup <domain>` that it returns the server's address before the first start.
- The records point at the server's Primary IPs. Resizing the server keeps them; before deleting a server, turn off the IPs' auto-delete so a new server can take them over, or update the records.

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
On the VPS, set `YSTO_DOMAIN` in `/opt/ysto/.env`, and for the daily challenge `YSTO_DAILY_SECRET` (`openssl rand -base64 32`; changing it changes every future day's songs, so set it once). The folder defaults match the ones created above.

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

## Open checks
Not yet done on the running VPS; each is a row in the [tech-debt tracker](exec-plans/tech-debt-tracker.md) until it is:
1. Time the clips on the VPS ([checks after setup](#checks-after-setup)). The load test passed on the development machine, not on the VPS.
2. Scan the ports from outside the VPS's network ([checks after setup](#checks-after-setup)).
3. Add `docker` to the required checks of the `main` ruleset (repo settings), next to `guard`, `docs`, `app` and `e2e`.

## Routines
### Release and update
1. Merge the PR with the version bump and its CHANGELOG entry.
2. *Owner machine*: start the release from main: `gh workflow run release.yml -f version=<version>`. It reruns CI, publishes `ghcr.io/xms61/ysto:<version>` and `:latest` for amd64 and arm64, tags `v<version>` and creates the GitHub release.
3. On the VPS: `cd /opt/ysto && docker compose pull && docker compose up -d`. Running games end with a notice, which is why this waits for a quiet moment.

To roll back, set `YSTO_VERSION=<older version>` in `/opt/ysto/.env` and run `docker compose up -d`. Remove it again to follow `latest`.

### A new catalog or library
Rebuild on the owner machine ([CATALOG.md](../scripts/catalog/CATALOG.md)), rerun step 4, then `docker compose restart ysto`. The server reads the catalog only at startup.

### Deploy files
When `deploy/compose.yml` or `deploy/Caddyfile` changes in a release, copy it over again (step 3) before `docker compose up -d`. 1.6.0 changes `compose.yml`: it adds the `ysto_state` volume for clip reports. Docker creates the volume on the first `up`. A server started without it (the old compose file) runs as before, logs `reports.unavailable`, and keeps reports only in its log.

### Clip reports
Players can report a round's clip from the reveal or the results' song list, with a fixed reason. The reports go into `reports.sqlite` in the `ysto_state` volume: the theme, where its clip started, the reason and the time, and nothing about the player. To list them, most reported first, with each clip's anime and file:
```bash
cd /opt/ysto && docker compose run --rm --no-deps ysto node scripts/clip-reports/list.ts
```
On the owner machine the same list is `npm run reports`, with `YSTO_STATE_DIR` set.

### Logs and disk
- `docker compose logs -f ysto`: the game's JSON log lines ([RELIABILITY.md](RELIABILITY.md#logging)). Docker keeps 3 files of 10 MB per service.
- `docker image prune -f` after updates removes old images.
- Nothing on the VPS needs a backup: the library and the catalog come from the owner machine, Caddy gets a new certificate if its volume is lost, and losing `ysto_state` loses only the clip reports not yet read.
