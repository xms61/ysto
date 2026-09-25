---
status: draft
last-verified: 2026-09-25
---

# Plans

## Which kind of plan
- **Small change** (one session, one area): no plan file. Keep notes in `docs/scratch/` if they help; the PR summary records the outcome.
- **Exec plan**: work that spans sessions or areas, a migration, or anything someone else may have to resume. It is committed with the code and updated in the same commits.

## Exec plans
- Create `docs/exec-plans/active/YYYY-MM-DD-<short-name>.md` from the template below before the first code change. Check the [active plans](exec-plans/active/) first: the work may already be planned.
- Write it for a reader who has only the repo and the plan: link the files and docs it depends on instead of assuming them.
- Tick progress items and log decisions as they happen, not at the end.
- In the change that finishes the work, fill in Outcome and move the file to the [completed plans](exec-plans/completed/). Follow-ups that won't be done now go in the [tech-debt tracker](exec-plans/tech-debt-tracker.md).

The doc checks require Purpose, Progress and Decision log in active plans, and Outcome as well in completed ones.

## Template
```md
# <Goal in a few words>

## Purpose
What a player or developer gets when this is done, and how to see it working.

## Context
The files, docs and constraints this work depends on, as links.

## Plan
Milestones in order, each small enough to verify on its own.

## Progress
- [ ] <milestone> (when done: `- [x] YYYY-MM-DD <milestone>`)

## Decision log
- YYYY-MM-DD: <decision>, because <reason>. Rejected: <alternatives>.

## Surprises
What turned out different from the plan, with the evidence.

## Validation
The commands to run and the result that shows the work is done.

## Outcome
Filled in when the plan moves to completed/: what shipped, what did not, and the follow-ups.
```
