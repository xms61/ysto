# Release Process

## Guardrails
- Never push to `main`: it changes only through a merged PR (see Pull request below). Work on `feat/<name>`, `fix/<name>`, or `chore/<name>`.
- Never commit `.env`, API keys, tokens, databases, user data, media files, dataset dumps, or anything in `docs/scratch/`. Git history keeps a file after it is deleted.
- Run `git status` before `git add`, and stage explicit paths (no `git add -A` on a dirty tree).
- Never skip hooks (`--no-verify`) or force-push a shared branch.

## Version bump (every PR)
- `patch` for fixes and cleanup, `minor` for new capability, `major` for breaking changes.
- Keep the version in sync everywhere it lives: `<package.json and package-lock.json / pyproject.toml / Cargo.toml>`.
- Add a `CHANGELOG.md` entry ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/): Added/Changed/Fixed/Removed). Read only the top entry and insert yours above it. Keep about 5 releases there, and move older entries to the top of `docs/CHANGELOG-archive.md`.
- Update `README.md` when commands, setup or features change, and every doc that describes the changed code ([knowledge base rules](../docs/KNOWLEDGE_BASE.md)).

## Pre-commit checklist
1. `<npm run lint>`: 0 errors, 0 warnings.
2. `<npm run test:ci>`: all pass.
3. `node scripts/check-docs.mjs`: no errors.
4. `git status`: no forbidden files staged.
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

CI ([.github/workflows/ci.yml](workflows/ci.yml)) runs only when started by hand (Actions tab, or `gh workflow run ci.yml --ref <branch>`), so it does not gate PRs. It runs the doc checks and their tests. The app's lint, typecheck, tests with coverage thresholds and build are added to it with the first app code.
