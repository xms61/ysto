---
status: verified
last-verified: 2026-09-29
---

# Clip service

Entry: `server/clips/cut.ts`. `clipCutter({ audioDir, ffmpegPath, concurrency })` returns the function that cuts a question's clip to MP3 bytes in memory. Why clips work this way: [audio clips](../../docs/design-docs/audio-clips.md).
- `ffmpeg.ts`: `runFfmpeg` spawns ffmpeg with an argument array and a time limit, and collects stdout.
- `limit.ts`: `concurrencyLimit` caps how many cuts run at once. The others wait in arrival order.
- `prepare.ts`: `prepareClip` cuts a round's clip. On a failure it moves the round to another theme, up to `THEMES_PER_ROUND`.
- `tokens.ts`: `ClipTokens` holds each issued clip under a random token, for one lobby, until it expires.
- `route.ts`: `GET /api/clips/:token`, mounted by `createApp` when it gets `clips`. M4 passes the session lookup.
- `../tokens.ts`: `newToken` and `isToken`, the one definition of a 256-bit token. Session tokens use it too.

## Rules
- ffmpeg never runs through a shell, and only on files inside `YSTO_AUDIO_DIR` (`fileInside`).
- Clips are cut to a pipe, never to a file. The container's filesystem is read-only apart from `/tmp`.
- Clip bytes carry no tags. The cut tests check this with ffprobe, and the decode test checks that browsers still play the result.
- Every refusal on the clip route is the same 404 with `Cache-Control: no-store`. Never add a 401 or 403 there.
- Logs name files relative to the audio folder, and never contain clip or session tokens ([SECURITY.md](../../docs/SECURITY.md)).
- The limits live as constants in `cut.ts` (bitrate, fades, the 10 s timeout, the 90% length rule) and `prepare.ts` (3 themes per round).

## Gotchas
- A cut that starts past the end of a file still returns about a second of audio, and ffmpeg exits 0. Only the length check catches it.
- ffmpeg's default LAME quality is slower than LAME's own default. The cutter asks for quality 5.
- ffmpeg names a missing input file on an earlier stderr line, not the last one. Error messages keep only the last line.
- `clipCutter` builds its own concurrency limit, so the server must create one cutter and share it.

## Tests
- `tests/clips/*.test.ts` cut generated Ogg Opus tones with the ffmpeg on PATH. They check the length and tags with ffprobe, path refusals, failures and timeouts, the concurrency limit, tokens on a fake clock, the route's 404s, and theme replacement.
- `e2e/clip-decode.spec.ts` decodes a cut clip through Web Audio in each Playwright browser.
- `npm run clips:bench` times cuts from the real library, one at a time (reads only). Run it on a new host to check the p95 target.
