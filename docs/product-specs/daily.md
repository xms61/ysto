---
status: draft
last-verified: 2026-10-06
---

# Daily challenge

## Goal
A reason to come back every day: the same ten songs for everyone, played alone in a few minutes, with a streak of the days played in a row and a result to share that gives no song away.

## Behavior
- **On the home screen**, when the server offers it, "Today's challenge" shows the day's number ("Daily No. 42"), this device's streak ("12 days in a row · best 20"), a badge at 7, 30 and 100 days in a row, and a button that starts it with the name in the name field. Once the day is played on this device, the button offers it again for practice.
- **The day** changes at 00:00 UTC (01:00 or 02:00 in Germany). Daily No. 1 was 1 October 2026 (`shared/daily.ts`).
- **The game** is the same for everyone that day: the same ten songs, the same sample starts and the same options, from a seed of the server's secret `YSTO_DAILY_SECRET` and the day's number (`server/game/daily.ts`). The code and the catalog's sources are public, so a seed from the date alone would let anyone list the day's answers in advance. The settings are fixed: Normal, ten songs of 15 s, Classic scoring (Speed with the streak bonus), four options, the anime named. Without the secret the daily is off: the home screen doesn't offer it, and `POST /api/daily` answers `daily-off`.
- **It runs as a private lobby** with one seat, locked so no one can join, whose settings and lock can't change (`daily-fixed`). It starts on its own as soon as its player is in. It counts as a lobby created, against the same limit per address.
- **The result**, above the usual results: the day, the right answers out of ten, the rounds as a grid of plain block characters (■ right, □ missed, · skipped), the streak, and a button that copies the line to share, such as "You Skipped The OP?! Daily No. 42 · 8/10 · 7,450 · day 12" with the grid on the next line. No emoji, and no song named.
- **The streak** lives on this device (`ysto_daily`), since the game has no accounts: the last day played, the run of days in a row up to it, and the best run. The next day in a row extends it, a missed day starts it again from 1, and only the first play of a day counts; a replay is marked "practice". Showing a result again (a reload at the results) doesn't count it twice. Clearing the browser's data resets the streak.

## Acceptance criteria
- The same secret and day give the same questions with the same sample starts; the next day, or another secret, gives others.
- The day's number changes at 00:00 UTC.
- A daily's lobby is locked with the fixed settings, and a join is refused.
- The streak counts consecutive days, starts again after a missed day, keeps the best, marks a second play of a day as practice, and works without storage.
- The share line is plain text with block characters and names no song.
- In a browser, one player plays a whole daily from the home screen and sees a streak of one day, then the home screen offers the day as practice (`e2e/daily.spec.ts`).

## Out of scope
- A transfer code to carry a streak to another device.
- A daily leaderboard of names.
