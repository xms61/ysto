# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.1] - 2026-09-25

### Added
- `scripts/check-tracked-files.mjs`, with tests, keeps the public repo clean. It blocks media, databases, metadata dumps, env files, keys and files over 1 MiB. It also blocks text that reveals this machine: home-folder paths and the local user or host name. A pre-commit hook in `.githooks/` runs it on staged files.
- gitleaks in CI, pinned by version and checksum, with an extra rule for home-folder paths (`.gitleaks.toml`).
- An allowlist `.dockerignore`, so new data folders stay out of images.
- Dependabot updates for the SHA-pinned actions.

### Changed
- CI runs on every pull request and every push to `main`, and its actions are pinned by commit SHA.
- `.gitignore` also covers audio and video files, metadata dumps and more key formats.

## [0.1.0] - 2026-09-25

### Added
- Repository setup: agent doc map (`AGENTS.md`), code style, testing and release docs, CI.
- Knowledge base: `ARCHITECTURE.md`, design docs, product specs, exec plans, topic docs, and `scripts/check-docs.mjs`, which CI runs to enforce links, frontmatter, indexes and plan sections.

---

Older releases (none yet) are in [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md).
