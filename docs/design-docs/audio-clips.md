---
status: draft
last-verified: 2026-09-25
---

# Audio clips and playback

## Context
Every play samples a new random part of a song, and the sample length is set per lobby (10–30 s). The source files are Ogg Opus, which not every Safari version plays. Players on iPhones need the 15% default volume to work too. And the clip must not reveal the song ([anti-cheat](anti-cheat.md)).

## Decision
**Cutting.**
- Each round's clip is cut on demand, with `ffmpeg -ss <offset> -t <length> -i <file> -vn -map_metadata -1 -af afade…`. It is encoded to AAC at 128 kbps (about 480 KB for 30 s), with a 0.3 s fade in and a 0.5 s fade out.
- M3 settles the container (M4A, with MP3 as the fallback) with a decode test in Chromium, Firefox, WebKit and on a real iPhone.
- ffmpeg runs through `spawn` with an argument array (no shell), a 10 s timeout and a concurrency limit (`YSTO_FFMPEG_CONCURRENCY`). If it fails, the round uses another theme (up to 3 tries), and the error is logged once.
- The next round's clip is cut during the current round.

**Serving.**
- The client never sends a path or ID for audio. The server resolves `rel_path` against `YSTO_AUDIO_DIR` and refuses any path that ends up outside it, which guards against a bad catalog row.
- `GET /api/clips/:token` answers 404 for unknown, expired or other-lobby tokens. It never answers 403, so tokens can't be probed. Responses carry `Cache-Control: no-store` and no filename.
- A token lives from the prepare message until 10 s after the reveal ends.

**Playing.**
- Clips play through the Web Audio API: fetch, then `decodeAudioData`, then a `GainNode`.
- The Create or Join click unlocks the `AudioContext`, as browser autoplay rules require.
- Each client estimates its offset from the server clock with `time:ping`, then starts the clip at `startsAt`. That way all players hear it start at about the same moment.

## Alternatives considered
- **Pre-cut clips at fixed offsets (Anagroove's approach):** rejected. They give a small, repeating set of samples, not a new random part each time.
- **Sending the full file for the client to seek in:** rejected. It hands over the whole song and its identity.
- **Slices of the Ogg Opus source:** rejected. Not every Safari version plays Ogg, and a slice doesn't strip what re-encoding strips.
- **The `<audio>` element:** rejected. iOS ignores `HTMLMediaElement.volume`, so the 15% default would not apply, and it can't schedule a start time.

## Consequences
- Each round costs one ffmpeg run. M3 measures it (target: p95 under 500 ms for 30 s on the host), and `YSTO_MAX_GAMES` keeps the total in check.
- Clips stay in memory until their token expires, which is about 1 MB per running game.
