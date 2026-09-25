# Release Process

## Guardrails
- Never push to `main`: it changes only through a merged PR (see Pull request below). Work on `feat/<name>`, `fix/<name>`, or `chore/<name>`.
- Never commit `.env`, API keys, tokens, databases, user data, media files, dataset dumps, or anything in `docs/scratch/`. Git history keeps a file after it is deleted.
- Never commit details of this machine: absolute paths into a home folder, the local user or host name, or folder layouts outside the repo. The repo is public. Refer to locations by env var (such as `YSTO_AUDIO_DIR`); the real values live in `.env`.
- `node scripts/check-tracked-files.mjs` enforces both rules, plus a 1 MiB limit per file (the lockfile excepted). The pre-commit hook runs it on staged files; enable the hook once per clone with `git config core.hooksPath .githooks`. CI runs it on every tracked file, and gitleaks scans the history for secrets and home-folder paths ([.gitleaks.toml](../.gitleaks.toml)).
- Run `git status` before `git add`, and stage explicit paths (no `git add -A` on a dirty tree).
- Never skip hooks (`--no-verify`) or force-push a shared branch.

## Version bump (every PR)
- `patch` for fixes and cleanup, `minor` for new capability, `major` for breaking changes.
- Keep the version in sync everywhere it lives: `package.json` and `package-lock.json`. `npm version <patch|minor|major> --no-git-tag-version` updates both.
- Add a `CHANGELOG.md` entry ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/): Added/Changed/Fixed/Removed). Read only the top entry and insert yours above it. Keep about 5 releases there, and move older entries to the top of `docs/CHANGELOG-archive.md`.
- Update `README.md` when commands, setup or features change, and every doc that describes the changed code ([knowledge base rules](../docs/KNOWLEDGE_BASE.md)).

## Pre-commit checklist
1. `npm run lint`: 0 errors, 0 warnings.
2. `npm run test:ci`: all pass. For client or route changes, `npm run build && npm run test:e2e` too.
3. `node scripts/check-docs.mjs`: no errors.
4. `node scripts/check-tracked-files.mjs`: no errors, and `git status` shows nothing staged by mistake.
5. Version bumped; CHANGELOG, README and affected docs updated; the exec plan's progress and decision log are current, if the work has one.

## Pull request
```bash
git push -u origin <branch>
gh pr create --base main --head <branch> --title "<type>(<scope>): <summary> (v<version>)" --body "<summary, key changes, test results>"
```
- Title types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`.
- The body lists what changed, what was checked, and what was not checked and why.
- If a PR is already open for the branch, push more commits to it.
- Merge with a merge commit once the pre-commit checklist passes on the branch.

CI ([.github/workflows/ci.yml](workflows/ci.yml)) runs on every pull request and every push to `main`, and can also be started by hand. The `main` ruleset requires all four jobs to pass before a PR can merge:
- `guard` runs the tracked-files check with its tests, then gitleaks.
- `docs` runs the doc checks and their tests.
- `app` runs `npm run test:ci` and the build.
- `e2e` runs the browser smoke test against the build, in Chromium and WebKit.

The ruleset also blocks a merge while CodeQL reports a new alert of high or critical severity, or a new error.

## Before a release
Run the doc-gardening pass ([KNOWLEDGE_BASE.md](../docs/KNOWLEDGE_BASE.md#doc-gardening)) and merge its fix-up PRs before tagging the release.
