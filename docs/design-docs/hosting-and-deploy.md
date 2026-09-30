---
status: draft
last-verified: 2026-09-30
---

# Hosting and deploy

## Context
The game runs on a rented VPS for friends, and anyone who has the URL can create a lobby. The repo is public, so its CI must hold no credentials for the server. The full audio library stays on the owner's machine, and the VPS gets an exported copy. The steps to set it up and keep it current are in the runbook, [DEPLOY.md](../DEPLOY.md).

## Decision
**Docker.**
- The `Dockerfile` has three stages: the production dependencies and the Vite build, both made on the build platform since neither depends on the CPU, and the runtime.
- The runtime is `node:24-alpine`, pinned by digest, with `ffmpeg` and `tini` from Alpine packages. npm, corepack and yarn are removed: the server doesn't need them, and their bundled packages were the image's only high findings in Trivy. It holds only production dependencies plus `server/`, `shared/`, `dist/` and the clip benchmark (`scripts/clips/bench.ts` with its one helper), so the host's clip timing is measured in the image that serves the game. It runs as the non-root `node` user, and has a `HEALTHCHECK` on `/healthz`.
- `.dockerignore` is an allowlist, so a new data folder can't enter the image.
- `deploy/compose.yml` runs two services, and the VPS gets it with the `Caddyfile` and a `.env` made from `deploy/.env.example`:
  - `ysto`, the game: the image from GHCR (`latest`, or `YSTO_VERSION` to roll back), with the exported library and the catalog mounted read-only. It publishes no port. The file sets the in-container folders and `YSTO_TRUST_PROXY=1` itself, so a copied `.env` can't point them elsewhere. It runs with a read-only root, a tmpfs `/tmp`, no capabilities, `no-new-privileges`, 1 GB of memory, 256 processes, and logs rotated at 3 files of 10 MB.
  - `caddy`: the only service on the public ports (80, 443 and 443/udp). It gets and renews the Let's Encrypt certificate for `YSTO_DOMAIN`, redirects HTTP to HTTPS, sets HSTS, and proxies HTTP and WebSockets to the game. Its certificates live in the `caddy_data` volume.
- Dependabot keeps both image digests current.

**VPS.**
- **Provider and size:** Hetzner Cloud, type CX23 (2 x86 vCPUs, 4 GB of RAM, 40 GB of disk) or CAX11 (the same on Arm). Releases build for amd64 and arm64, so either works, and the owner takes whichever is available. The export fits the 40 GB disk with room for updates. A 30 s clip took about 0.3 s of one core on the development machine (M3), and the runbook's bench on the VPS confirms the size. If it misses, the 4-vCPU types (CX33, CAX21) keep the disk and the address.
- **Domain:** the game is served on a domain over HTTPS, never on the bare IP. The domain is set only in the VPS's `.env` (`YSTO_DOMAIN`), so the repo names none.
- **Library upload:** `npm run catalog:export` re-encodes every file the catalog plays to 128 kbps Opus, without metadata, at the same relative paths, so the catalog works unchanged. That is about half the library's size. Reruns encode only new or changed files and remove copies the catalog no longer plays. `rsync` sends the export and the catalog folder to the VPS, and later runs send only changes. Clips are re-encoded to 128 kbps MP3 anyway, so a 128 kbps Opus source costs little quality.
- **Catalog:** built on the owner machine, which holds the original library and the ingest caches, and sent with the export.
- **Firewall:** a Hetzner Cloud Firewall and ufw allow only 22, 80 and 443. Docker publishes ports past ufw rules, so only Caddy publishes any.
- **SSH** accepts keys only, root login is off, and security updates install unattended.
- **Search engines:** `robots.txt` disallows everything and every response carries `noindex`. There is no public lobby list.

**Release and deploy.**
- `release.yml` is started by hand from main. It takes a version as input, then:
  1. reruns the CI jobs (CI is also a reusable workflow)
  2. checks that the version matches `package.json`, has a CHANGELOG entry and isn't released yet
  3. builds the image for amd64 and arm64
  4. pushes `ghcr.io/xms61/ysto:<version>` and `:latest` with SBOM and provenance attestations
  5. tags `v<version>` and creates a GitHub release from the CHANGELOG entry
- Deploys are pull-based: over SSH, the owner runs `docker compose pull && docker compose up -d` on the VPS.
- CI has a `docker` job. It builds the image and runs it, hardened as on the VPS, on the browser tests' fixture catalog until `/readyz` answers. It then cuts clips in the image with the benchmark, checks that the image holds no audio, database or `.env` file, and runs Trivy (pinned by version and checksum), which fails on fixable high or critical issues.

## Alternatives considered
- **A home machine behind a tunnel:** rejected by the owner in favor of a VPS.
- **Deploying from Actions over SSH, or a self-hosted runner:** rejected. A public repo's CI must not hold credentials for the server, and pull requests from forks must never reach it.
- **Uploading the original library:** rejected. It's about twice the size, for quality the 128 kbps clips don't use.
- **Building the catalog on the VPS (an `ingest` compose profile, the first plan):** rejected in M8. The build reads the original library and the ingest caches, which stay on the owner machine, and it would need the catalog scripts and network access in the image.
- **Caddy as a system package beside the container:** rejected in M8. In compose it is pinned and updated like the game, and the game needs no published port at all.
- **Trivy's GitHub Action:** rejected. The binary is pinned by version and checksum, like gitleaks, so a moved tag can't change what runs.

## Consequences
- The image is public and safe to be: it holds no audio, catalog or covers.
- Every deploy is a manual step by the owner.
- The copyright exposure of open lobby creation is covered in [SECURITY.md](../SECURITY.md).
