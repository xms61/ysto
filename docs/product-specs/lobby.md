---
status: draft
last-verified: 2026-10-06
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
- **Tally:** a lobby that plays several games keeps a tally of them: the games played, and each player's wins and points. Everyone sharing the top score wins, if it is above zero; a game where no round could be played doesn't count. The lobby's player list shows each player's wins, and from the second game the results say who leads ("Game 3 in this lobby. Ann has won 2."). A player who drops keeps their line; one who leaves takes it with them. The tally lasts as long as the lobby.
- **Animals:** each player has an animal (fox, cat, owl, frog, panda, rabbit, bear, penguin, tanuki, octopus, crane, koi, dog, turtle, hamster, chick), drawn for the game: on a paper badge of the same paper and ink in every theme in the lists, and at the reveal as a one-color stamp in the world's stamp ink. A player who joins gets one nobody in the lobby has; in the lobby, "Your animal" lets them pick another, and the ones others have are stepped back and named. Only once all sixteen are taken do two players share one. The animal marks the player in the player list, the scores beside the round, the scoreboard and the results, and stamps their pick on its card at the reveal.
- **Reactions:** in the lobby, all through a round (at the foot of the scores column) and on the results, a bar of seven reactions: hype, laugh, shock, facepalm, heart and clap as the platform's emoji, and the game's own "?!" ("What?!") in the world's display face, each a bare glyph without a frame. A reaction appears at a random spot round the button its sender pressed, or for everyone else round the sender's name wherever it shows (the player list, the scoreboard, the pickers, the bill), or in the corner with the name when it isn't on screen; it drifts up on its own path, swaying in smooth curves, and fades. Screen readers hear "Ben: Heart". Players can spam them: the server passes up to 8 a second per player, and the screen keeps the newest 40. A reaction carries no option, so reacting during a round is allowed (the owner's call, 2026-10-06).
- **Screens:** a TV or laptop can join by the join link with "Use as the screen" instead of a name, for party mode ([game flow](game-flow.md)). It is named "Screen" ("Screen 2" beside another), listed with a "screen" tag, and doesn't count toward the 12 players; a lobby takes two at most (`screens-full`), and a locked lobby none. A screen never answers, scores, joins a team or becomes the host.
- **Expiry:** a lobby closes 15 s after its last player left or lost the connection, unless someone comes back first, and after 4 hours in any case.
- **Lobby creation** is open to anyone who has the URL. Limits keep it from being abused ([SECURITY.md](../SECURITY.md)).

## Acceptance criteria
- Joining with a code or a link and a free name puts the player in the lobby.
- A wrong code, a full or locked lobby, and a taken name each get a clear message.
- A kicked player can't rejoin with the same session.
- When the host leaves, another player becomes host, and every client sees the change.
- A player who reloads within 60 s is back in their seat with their score.

## Out of scope
- Accounts, friend lists and a public lobby list.
- Chat, and reactions beyond the fixed seven.
