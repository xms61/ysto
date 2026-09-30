---
status: draft
last-verified: 2026-09-30
---

# Audio clips and playback

## Context
Every play samples a new random part of a song, and the sample length is set per lobby (10–30 s). The source files are Ogg Opus, which not every Safari version plays. Players on iPhones need the 15% default volume to work too. And the clip must not reveal the song ([anti-cheat](anti-cheat.md)).

## Decision
**Cutting** (`server/clips/`, [CLIPS.md](../../server/clips/CLIPS.md)).
- Each round's clip is cut on demand at the question's offset: `ffmpeg -ss <offset> -t <length> -i <file> -map 0:a:0 -map_metadata -1 -af afade… -c:a libmp3lame -b:a 128k -compression_level 5 -id3v2_version 0 -write_xing 0 -f mp3 pipe:1`.
- **The format is MP3**, at 128 kbps and 48 kHz: about 480 KB for 30 s, with a 0.3 s fade in and a 0.5 s fade out. It has no ID3 tag and no Xing header, so ffprobe finds no tags and the bytes hold no encoder name. M3 settled it:
  - MP3 decodes in every browser, including builds without proprietary codecs.
  - AAC took more than twice as long to encode. A 20 s clip of a test tone took 275 ms in AAC and 115 ms in MP3.
  - AAC's MP4 container carries fields that ffprobe reports as tags.
- The decode test (`e2e/clip-decode.spec.ts`) decodes the cutter's output through Web Audio. It runs in Chromium, Firefox and WebKit in CI, and it passed in Chrome and Edge. Since M6, the browser game test also plays every round's clip in each browser. On 2026-09-30 a whole game on a real iPhone played every clip, at 15% by default and with the silent switch on.
- LAME runs at quality 5, its standard level. That is about a fifth faster than ffmpeg's default, and it keeps the noise shaping that level 7 drops.
- ffmpeg runs through `spawn` with an argument array (no shell), a 10 s timeout and a concurrency limit (`YSTO_FFMPEG_CONCURRENCY`).
- A clip under 90% of its length counts as a failed cut, because the file is shorter than the catalog says. A cut that starts past the end still returns about a second of audio.
- If a cut fails, the round uses another theme, from an anime the game doesn't use yet, up to 3 themes. Each failure is logged once.
- The next round's clip is cut during the current round: the game engine asks for it when a round's prepare message goes out.
- A 30 s clip from the library took 282 ms at the median and 306 ms at the 95th percentile on the development machine (`npm run clips:bench`). M8 repeats the measurement on the VPS.

**Serving.**
- The client never sends a path or ID for audio. The cutter resolves `rel_path` against `YSTO_AUDIO_DIR` and refuses any path that ends up outside it, which guards against a bad catalog row.
- `GET /api/clips/:token` needs `Authorization: Bearer <sessionToken>` from a player of the lobby that owns the clip.
- Unknown, expired and other-lobby tokens get the same 404 as a missing or unknown session. The route never answers 401 or 403, so tokens can't be probed. Responses carry `Cache-Control: no-store` and no filename.
- A token is issued as soon as its clip is cut, but no client learns it before the prepare message. It lives until 10 s after the reveal ends, or 10 minutes if the game ends first. Expired clips leave memory when the next token is issued.

**Playing** (`src/audio/engine.ts`).
- Clips play through the Web Audio API: a fetch with the session token, then `decodeAudioData`, then a gain node per clip for its fade and a master gain node for the volume. The volume is linear gain, so 15% on the slider is a gain of 0.15.
- Browsers let an `AudioContext` start only from a tap, a click or a key, so the Create and Join buttons unlock it. After a reload, a "Turn on sound" button does.
- iPhones play Web Audio as ambient sound, which the silent switch mutes. Where Safari offers `navigator.audioSession`, the engine sets its type to `playback`, as for a media element.
- Each client estimates the server clock's offset with `time:ping`: five pings on connecting, one every 10 s, and one with each prepare. It keeps the offset from the shortest of the last 8 round trips, and starts the clip at `startsAt` on its own clock, so all players hear it start at about the same moment.
- A clip that is ready late, or unlocked late, starts partway in, where the round is. After the system suspends audio (an iPhone's lock screen), the clip restarts where the round is.
- The clip plays on through the reveal. It fades out over 0.4 s when the next round is prepared, when the host skips, or when the game ends.
- A failed fetch or decode sends `round:ready` with `loaded: false`, so the barrier doesn't wait for that player.

## Alternatives considered
- **Pre-cut clips at fixed offsets (Anagroove's approach):** rejected. They give a small, repeating set of samples, not a new random part each time.
- **Sending the full file for the client to seek in:** rejected. It hands over the whole song and its identity.
- **Slices of the Ogg Opus source:** rejected. Not every Safari version plays Ogg, and a slice doesn't strip what re-encoding strips.
- **AAC in M4A (the first plan):** rejected in M3. It encoded more than twice as slowly, and builds without proprietary codecs can't decode it.
- **The `<audio>` element:** rejected. iOS ignores `HTMLMediaElement.volume`, so the 15% default would not apply, and it can't schedule a start time.

## Consequences
- Each round costs one ffmpeg run of about 0.3 s for 30 s of audio. `YSTO_MAX_GAMES` keeps the total in check.
- Clips stay in memory until their token expires, which is about 1 MB per running game.
- A player who can't hear the clip (no Web Audio, or no tap yet after a reload) can still answer. A clip that failed to load marks them "no audio" in the reveal.
- Setting the audio session to `playback` pauses other audio on an iPhone, such as music, as a video would.
