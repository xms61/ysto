---
status: stub
last-verified: 2026-09-25
---

# Security

## Secrets
Secrets live in `.env`, which git ignores; [.env.example](../.env.example) lists every variable. What must never be committed is in the [release guardrails](../.github/RELEASE_PROCESS.md).

## Input
Every external input is validated once, at the boundary ([CODE_STYLE.md](CODE_STYLE.md#errors-and-boundaries)). <Where the validators live.>

## External services
<Each service, the key it uses, and what data it receives.>

## User data
<What is stored about players, where, and for how long.>

## Dependencies
<How new dependencies are chosen and kept up to date.>
