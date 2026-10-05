---
status: draft
last-verified: 2026-10-05
---

# Lobby

## Goal
Friends get into a game within seconds and without accounts: a code or a link, a name, and they're in.

## Behavior
- **Codes** are accepted in any case. They have 6 characters from a 31-character alphabet with no look-alikes (no 0/O or 1/I/L), giving about 887 million codes. The lobby screen shows the code, a join link (`/j/<code>`) and a QR code, and the address bar shows the join link while a player is in the lobby. A join link opens the home screen ready to join, asking only for a name.
- **Names** are 1–20 characters after Unicode NFKC normalization and trimming. Control and format characters (zero-width, bidi overrides) are removed. Names are unique per lobby, ignoring case. A taken name asks for another.
- **Size:** up to 12 players.
- **Host:**
  - The creator is the host. When the host leaves, or stays away past the 60 s grace, the player who has been connected longest takes over. With nobody connected, the next player to connect becomes host.
  - The host can kick players and lock the lobby.
  - The host can skip a round whose clip sounds broken. A skipped round scores nothing.
  - The host changes the [settings](settings.md) between games.
- **Late joins:** a player who joins during a game watches and hears the round in progress, then plays from the next round, starting at 0 points.
- **Reconnects:** a player who drops keeps their seat and score for 60 s, and the client reconnects on its own. A player who leaves on purpose gives up the seat at once. A second tab with the same seat takes it over from the first, which offers to take it back.
- **New versions:** every lobby update carries the server's version. A page built from another version reloads itself in the lobby or on the results, never during a round, and keeps its seat. It tries once per server version, so a cached old page can't reload forever.
- **Expiry:** a lobby closes after 15 minutes with no connected player, and after 4 hours in any case.
- **Lobby creation** is open to anyone who has the URL. Limits keep it from being abused ([SECURITY.md](../SECURITY.md)).

## Acceptance criteria
- Joining with a code or a link and a free name puts the player in the lobby.
- A wrong code, a full or locked lobby, and a taken name each get a clear message.
- A kicked player can't rejoin with the same session.
- When the host leaves, another player becomes host, and every client sees the change.
- A player who reloads within 60 s is back in their seat with their score.

## Out of scope
- Accounts, friend lists and a public lobby list.
- Chat. Emote reactions may come later.
