---
status: draft
last-verified: 2026-09-25
---

# Hosting and deploy

## Context
The game runs on a rented VPS for friends, and anyone who has the URL can create a lobby. The repo is public, so its CI must hold no credentials for the server. The full audio library stays on the owner's machine, and the VPS gets an exported copy. M8 turns this doc into a runbook (`docs/DEPLOY.md`), and the domain, the VPS provider and its CPU architecture are decided there.

## Decision
**Docker.**
- The `Dockerfile` has three stages: dependencies, the Vite build (run on the build platform), and the runtime.
- The runtime is `node:24-alpine`, pinned by digest, with `ffmpeg` and `tini` from Alpine packages. It holds only production dependencies plus `server/`, `shared/` and `dist/`, runs as the non-root `node` user, and has a `HEALTHCHECK` on `/healthz`.
- `.dockerignore` is an allowlist, so a new data folder can't enter the image.
- `docker-compose.yml`:
```yaml
services:
  ysto:
    image: ghcr.io/xms61/ysto:latest
    restart: unless-stopped
    env_file: .env
    ports: ["127.0.0.1:3000:3000"]        # only Caddy on the same host reaches it
    volumes:
      - ${YSTO_AUDIO_HOST_DIR}:/data/audio:ro
      - ./data/catalog:/data/catalog:ro
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    mem_limit: 1g
    pids_limit: 256
    logging:
      driver: json-file
      options: { max-size: 10m, max-file: "3" }
```
- An `ingest` compose profile runs `npm run catalog:build` in the same image, with the catalog folder writable and network access for the APIs.

**VPS.**
- **Size:** 2–4 vCPUs, 4 GB of RAM, and disk for the library, or an attached volume. M3 measures the CPU cost of a clip, which confirms the size.
- **Library upload:** `npm run catalog:export` re-encodes the library at 128 kbps, which shrinks it to about 40% of its size. `rsync` sends the export folder to the VPS, and later runs send only changes. Clips are re-encoded to 128 kbps AAC anyway, so a 128 kbps Opus source costs little quality.
- **Caddy** is the only service on the public ports (80 and 443). It gets certificates from Let's Encrypt, sets HSTS and proxies WebSockets.
- **Firewall:** only 22, 80 and 443 are open. Docker publishes ports past ufw rules, so the app binds to 127.0.0.1 and only Caddy reaches it.
- **SSH** accepts keys only, root login is off, and security updates install unattended.
- **Search engines:** `robots.txt` disallows everything and every response carries `noindex`. There is no public lobby list.

**Release and deploy.**
- `release.yml` is started by hand. It takes a version as input, then:
  1. reruns the CI jobs
  2. builds the image for amd64 and arm64
  3. pushes `ghcr.io/xms61/ysto:<version>` and `:latest` with SBOM and provenance attestations
  4. tags `v<version>`
  5. creates a GitHub release from the CHANGELOG entry
- Deploys are pull-based: over SSH, the owner runs `docker compose pull && docker compose up -d` on the VPS.
- CI gains a `docker` job. It builds the image and runs it with fixtures until `/readyz` answers, checks that the image holds no audio or database files, and runs a Trivy scan that fails on fixable high or critical issues.

## Alternatives considered
- **A home machine behind a tunnel:** rejected by the owner in favor of a VPS.
- **Deploying from Actions over SSH, or a self-hosted runner:** rejected. A public repo's CI must not hold credentials for the server, and pull requests from forks must never reach it.
- **Uploading the original library:** rejected. It's about 2.5 times the size, for quality the 128 kbps clips don't use.

## Consequences
- The image is public and safe to be: it holds no audio, catalog or covers.
- Every deploy is a manual step by the owner.
- The copyright exposure of open lobby creation is covered in [SECURITY.md](../SECURITY.md).
