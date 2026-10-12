---
status: draft
last-verified: 2026-10-12
---

# Daily challenges

## Goal
A reason to come back every day: three dailies, ten openings, ten endings and ten of either, each the same for everyone, played alone in a few minutes, each with a streak of the days played in a row and a result to share that gives no song away.

## Behavior
- **The dailies**: Openings (ten openings), Endings (ten endings) and Both (ten of either, the single daily before 1.30.0). They share the day's number and the rules below, and each is drawn on its own, so one song can turn up in two dailies of a day.
- **On the home screen**, when the server offers them, "Today's challenges" shows the day's number ("Daily No. 42") and a row per daily: what it plays, this device's streak for it ("12 days in a row · best 20"), a badge at 7, 30 and 100 days in a row, and a button ("Play Openings") that starts it with the name in the name field. Once a daily is played on this device that day, its button offers it again for practice ("Practice Openings").
- **The day** changes at 00:00 UTC (01:00 or 02:00 in Germany). Daily No. 1 was 1 October 2026 (`shared/daily.ts`).
- **Each game** is the same for everyone that day: the same ten songs, the same sample starts and the same options, from a seed of the server's secret `YSTO_DAILY_SECRET`, the day's number and the daily (`server/game/daily.ts`). Both keeps the seed the single daily had, so its songs didn't change with the release. The code and the catalog's sources are public, so a seed from the date alone would let anyone list the day's answers in advance. The settings are fixed: Normal, ten songs of 15 s, Classic scoring (Speed with the streak bonus), four options, the anime named, and the daily's theme kinds (openings, endings, or both). Without the secret the dailies are off: the home screen doesn't offer them, and `POST /api/daily` answers `daily-off`.
- **It runs as a private lobby** with one seat, locked so no one can join, whose settings and lock can't change (`daily-fixed`). It starts on its own as soon as its player is in. It counts as a lobby created, against the same limit per address.
- **The result**, above the usual results: the day and the daily, the right answers out of ten, the rounds as one line of colored square emoji (green right, red wrong or unanswered, grey skipped), the daily's streak, and a button that copies the text to share, made to paste into a chat such as Discord the way Wordle's results are: "You Skipped The OP?!" and "Daily #42 · Endings" on the next line, a blank line, the line of squares, a blank line, then "7/10 · 6,850 pts" with a fire emoji and the streak from two days in a row. No song is named.
- **The streaks** live on this device (`ysto_daily`), since the game has no accounts, one per daily: the last day played, the run of days in a row up to it, and the best run. Playing one daily never moves another's streak. The next day in a row extends a streak, a missed day starts it again from 1, and only a daily's first play of a day counts; a replay is marked "practice". Showing a result again (a reload at the results) doesn't count it twice. A device's streak from before 1.30.0 carries on as the Both streak. Clearing the browser's data resets the streaks.

## Acceptance criteria
- The same secret, day and daily give the same questions with the same sample starts; the next day, another secret or another daily gives others. Openings plays only openings and Endings only endings. Both's seed is the one the single daily had.
- The day's number changes at 00:00 UTC.
- A daily's lobby is locked with that daily's fixed settings, and a join is refused. A request without a daily opens Both; an unknown daily is refused.
- Each daily's streak counts consecutive days, starts again after a missed day, keeps the best, marks a second play of a day as practice, and works without storage; the other dailies' streaks don't move. A streak stored before 1.30.0 reads as Both's.
- The share text is the header with the daily, the rounds as one line of squares (right, missed, skipped), and the score line, and names no song.
- In a browser, one player plays the Openings daily from the home screen and sees a streak of one day, then the home screen offers Openings as practice and the other two to play (`e2e/daily.spec.ts`; the browser tests' catalog has only openings).

## Out of scope
- A transfer code to carry a streak to another device.
- A daily leaderboard of names.
